import { environment } from '../../environment'
import { IBlock, IEra, VerifierStatus } from './watchdog.types'
import { FastifyInstance } from 'fastify'
import { ConfigService } from '../config/config'
import { BlocksService } from '../blocks/blocks'
import { StakingService } from '../staking/staking'

const { DB_SCHEMA } = environment

const ERA_DELAY_OFFSET = 6

let app: FastifyInstance
let concurrency = 1
let resolve: { (arg0: number): void; (value: number | PromiseLike<number>): void }
let status: VerifierStatus = VerifierStatus.NEW
let lastCheckedBlockId = -1
let restartBlockId = -1
let currentEraId = -1
let blocksService: BlocksService
let configService: ConfigService
let stakingService: StakingService

const getWatchdogStatus = (): VerifierStatus => status
const setWatchdogStatus = (newStatus: VerifierStatus) => (status = newStatus)
const setCurrentEra = (eraId: number) => (currentEraId = eraId)
const getCurrentEra = (): number => currentEraId

const getBlockFromDB = async (blockId: number): Promise<IBlock> => {
  const { postgresConnector } = app
  try {
    const { rows } = await postgresConnector.query({
      text: `SELECT * FROM ${DB_SCHEMA}.blocks WHERE "id" = $1::int`,
      values: [blockId]
    })

    return rows[0]
  } catch (err) {
    app.log.error(`failed to get block by id ${blockId}, error: ${err}`)
    throw new Error('cannot getblock by id')
  }
}

const isEventsExist = async (block: IBlock): Promise<boolean> => {
  const { postgresConnector, polkadotConnector } = app
  try {
    const {
      rows: [{ count }]
    } = await postgresConnector.query({
      text: `SELECT count(*) FROM ${DB_SCHEMA}.events WHERE "block_id" = $1::int`,
      values: [block.id]
    })

    const eventsInBlockchainCount = await polkadotConnector.query.system.eventCount.at(block.hash)

    return +count === eventsInBlockchainCount.toNumber()
  } catch (err) {
    app.log.error(`failed to get events for block ${block.id}, error: ${err}`)
    throw new Error(`cannot check events for block ${block.id}`)
  }
}

const isExtrinsicsExist = async (block: IBlock): Promise<boolean> => {
  const { postgresConnector, polkadotConnector } = app
  try {
    const {
      rows: [{ count }]
    } = await postgresConnector.query({
      text: `SELECT count(*) FROM ${DB_SCHEMA}.extrinsics WHERE "block_id" = $1::int`,
      values: [block.id]
    })

    // https://github.com/polkadot-js/api/issues/3383
    // const extrinsicsInBlockchainCount = await polkadotConnector.query.system.extrinsicCount.at(block.hash)

    // temporary method to check if extinsics count in db is correct, should be replaced with the commented method above
    const signedBlock = await polkadotConnector.rpc.chain.getBlock(block.hash)

    const calculateExtrinsicsCountWithNestedBatch = (extrinsics: any) => {
      const reducer = (acc: number, extrinsic: { method: { method: string; args: (string | any[])[] } }) => {
        if (extrinsic.method.method === 'batch') {
          // add batch extrinsic and subextrinsics inside batch
          return acc + extrinsic.method.args[0].length + 1
        }
        return acc + 1
      }

      return extrinsics.reduce(reducer, 0)
    }

    const extrinsicsCount = calculateExtrinsicsCountWithNestedBatch(signedBlock.block.extrinsics)

    return +count === extrinsicsCount
  } catch (err) {
    app.log.error(`failed to get extrinsics for block ${block.id}, error: ${err}`)
    throw new Error(`cannot check extrinsics for block ${block.id}`)
  }
}

const verifyBlock = async (blockId: number): Promise<void> => {
  const blockFromDB = await getBlockFromDB(blockId)
  if (!blockFromDB) {
    app.log.debug(`block is not exists in DB: ${blockId}`)

    try {
      await blocksService.processBlock(blockId, true)
      return
    } catch (error) {
      app.log.error(`error in blocksService.processBlock invocation when try to resync missed block ${blockId}`)
    }
  }

  const isEventsExists = await isEventsExist(blockFromDB)
  const isExtrinsicsExists = await isExtrinsicsExist(blockFromDB)

  if (!isEventsExists || !isExtrinsicsExists) {
    app.log.debug(`events or extrinsics is not exist in DB for block ${blockId}`)
    try {
      await blocksService.processBlock(blockId, true)
    } catch (error) {
      app.log.error(`error in blocksService.processBlock invocation when try to resync missed events for block ${blockId}`)
    }
  }
}

const getEraFromDB = async (eraId: number): Promise<IEra> => {
  const { postgresConnector } = app
  try {
    const { rows } = await postgresConnector.query({
      text: `SELECT * FROM ${DB_SCHEMA}.eras WHERE "era" = $1::int`,
      values: [eraId]
    })

    return rows[0]
  } catch (err) {
    app.log.error(`failed to get era by id ${eraId}, error: ${err}`)
    throw new Error(`cannot get era by id ${eraId}`)
  }
}

interface IEraData {
  validators_active: number
  nominators_active: number
}

const verifyEraOfBlockId = async (blockId: number): Promise<void> => {
  const { polkadotConnector } = app
  const block = await getBlockFromDB(blockId)

  const isEraChanged = block.era > getCurrentEra()
  if (!isEraChanged) return

  setCurrentEra(block.era)

  const delayedEra = block.era - ERA_DELAY_OFFSET

  const isDelayedEraExists = delayedEra >= 0
  if (!isDelayedEraExists) return

  const eraFromDB = await getEraFromDB(delayedEra)

  const resyncEra = async (eraId: number, block: IBlock) => {
    stakingService.extractStakers(eraId, block.hash)
  }

  if (!eraFromDB) {
    app.log.debug(`era is not exists in DB: ${delayedEra}, resync`)
    try {
      await resyncEra(delayedEra, block)
      return
    } catch (error) {
      app.log.error(`error whan trying to resync era ${delayedEra}`)
    }
  }

  const [sessionId, blockTime] = await Promise.all([
    polkadotConnector.query.session.currentIndex.at(block.hash),
    polkadotConnector.query.timestamp.now.at(block.hash)
  ])

  const stakingData = await stakingService.getValidators(block.hash, sessionId, blockTime, delayedEra)

  const isEraDataValid = (eraFromDB: IEra, eraData: IEraData): boolean => {
    return eraData.validators_active === eraFromDB.validators_active && eraData.nominators_active === eraFromDB.nominators_active
  }

  if (!isEraDataValid(eraFromDB, stakingData.era_data)) {
    app.log.debug(`era in DB is not equals data from api: ${blockId}, resync`)
    try {
      await resyncEra(delayedEra, block)
      return
    } catch (error) {
      app.log.error(`error whan trying to resync era ${delayedEra}`)
    }
  }

  app.log.debug(`Era ${eraFromDB.era} is correct`)
}

const isStartHeightValid = async (blockId: number): Promise<boolean> => {
  const watchdogVerifyHeight = await configService.getConfigValueFromDB('watchdog_verify_height')
  app.log.debug(`Current db watchdog_verify_height = ${watchdogVerifyHeight}`)

  return blockId >= 0 && blockId - 1 <= +watchdogVerifyHeight
}

const updateLastCheckedBlockIdIfRestartOrBlocksEnd = async (lastCheckedBlockId: number): Promise<number> => {
  const lastProcessedBlockId = await blocksService.getLastProcessedBlock()

  const isLastBlock = () => lastCheckedBlockId === lastProcessedBlockId

  if (isLastBlock()) {
    setWatchdogStatus(VerifierStatus.IDLE)
    await configService.updateConfigValueInDB('watchdog_finished_at', Date.now())
    return new Promise((resolveLink) => {
      resolve = resolveLink
    })
  }

  const resultBlockId = getWatchdogStatus() === VerifierStatus.RESTART ? restartBlockId : lastCheckedBlockId

  setWatchdogStatus(VerifierStatus.RUNNING)

  return resultBlockId
}

const getNextBlocksCount = async (currentBlockId: number) => {
  const lastProcessedBlockId = await blocksService.getLastProcessedBlock()

  if (lastProcessedBlockId - currentBlockId > concurrency) return concurrency
  return lastProcessedBlockId - currentBlockId
}

const getNextBlockIdInterval = async (currentBlockId: number): Promise<Array<number>> => {
  const nextBlocksCount = await getNextBlocksCount(currentBlockId)

  return Array(nextBlocksCount)
    .fill('')
    .map((_, i) => currentBlockId + i + 1)
}

export const run = async (startBlockId: number): Promise<void> => {
  const isStartBlockValid = await isStartHeightValid(startBlockId)

  if (!isStartBlockValid) {
    app.log.debug(`Attempt to run verification with blockId greater than current watchdog_verify_height. Exit with error.`)
    process.exit(0)
  }

  await configService.updateConfigValueInDB('watchdog_started_at', Date.now())
  app.log.info(`Watchdog start from blockId ${startBlockId}`)

  lastCheckedBlockId = startBlockId - 1
  setWatchdogStatus(VerifierStatus.RUNNING)

  while (true) {
    const blocksToCheck = await getNextBlockIdInterval(lastCheckedBlockId)

    await Promise.all([...blocksToCheck.map((blockId) => verifyBlock(blockId)), verifyEraOfBlockId(blocksToCheck[0])])

    lastCheckedBlockId = blocksToCheck[blocksToCheck.length - 1]

    await configService.updateConfigValueInDB('watchdog_verify_height', lastCheckedBlockId)

    lastCheckedBlockId = await updateLastCheckedBlockIdIfRestartOrBlocksEnd(lastCheckedBlockId)
  }
}

interface IWatchdogStatus {
  status: VerifierStatus
  current_height: number
  finished_at: string | undefined
}

export const getStatus = async (): Promise<IWatchdogStatus> => {
  const result = {
    status,
    current_height: lastCheckedBlockId,
    finished_at: undefined
  }

  if (getWatchdogStatus() !== VerifierStatus.IDLE) return result

  const finished_at = await configService.getConfigValueFromDB('watchdog_finished_at')

  return { ...result, finished_at }
}

interface IWatchdogRestartResponse {
  result: boolean
}

export const setNewStartBlockId = async (newStartBlockId: number): Promise<IWatchdogRestartResponse> => {
  const isStartBlockValid = await isStartHeightValid(newStartBlockId)

  if (!isStartBlockValid) {
    return {
      result: false
    }
  }

  if (getWatchdogStatus() === VerifierStatus.IDLE) {
    resolve(newStartBlockId - 1)
  } else {
    restartBlockId = newStartBlockId - 1
    setWatchdogStatus(VerifierStatus.RESTART)
  }

  return { result: true }
}

export const init = (appParam: FastifyInstance, concurrencyParam: number): void => {
  concurrency = concurrencyParam
  setWatchdogStatus(VerifierStatus.NEW)
  app = appParam
  blocksService = new BlocksService(app)
  configService = new ConfigService(app)
  stakingService = new StakingService(app)
}

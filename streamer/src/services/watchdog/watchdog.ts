import { environment } from '../../environment'
import { IBlock, IEra, VerifierStatus } from './watchdog.types'
import { FastifyInstance } from 'fastify'
import { ConfigService } from '../config/config'
import { BlocksService } from '../blocks/blocks'
import { BlockHash, SignedBlock } from '@polkadot/types/interfaces'

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

const isExtrinsicsExist = async (block: IBlock, blockFromChain: SignedBlock): Promise<boolean> => {
  const { postgresConnector } = app
  try {
    const {
      rows: [{ count }]
    } = await postgresConnector.query({
      text: `SELECT count(*) FROM ${DB_SCHEMA}.extrinsics WHERE "block_id" = $1::int`,
      values: [block.id]
    })

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

    const extrinsicsCount = calculateExtrinsicsCountWithNestedBatch(blockFromChain.block.extrinsics)

    return +count === extrinsicsCount
  } catch (err) {
    app.log.error(`failed to get extrinsics for block ${block.id}, error: ${err}`)
    throw new Error(`cannot check extrinsics for block ${block.id}`)
  }
}

const isBlockValid = async (blockId: number): Promise<boolean> => {
  const { polkadotConnector } = app

  const blockFromDB = await getBlockFromDB(blockId)

  if (!blockFromDB) {
    app.log.debug(`Block is not exists in DB: ${blockId}`)
    return false
  }

  const blockFromChain = await polkadotConnector.rpc.chain.getBlock(blockFromDB.hash)

  const isEventsExists = await isEventsExist(blockFromDB)
  const isExtrinsicsExists = await isExtrinsicsExist(blockFromDB, blockFromChain)
  const isParentHashValid = blockFromDB.parent_hash === blockFromChain.block.header.parentHash.toString()

  if (!isEventsExists || !isExtrinsicsExists || !isParentHashValid) {
    app.log.debug(`Events or extrinsics is not exist in DB for block ${blockId}`)
    return false
  }

  return true
}

const verifyBlock = async (blockId: number): Promise<void> => {
  app.log.debug(`Validate block ${blockId}`)
  const isBlockValidResult = await isBlockValid(blockId)
  if (!isBlockValidResult) {
    try {
      app.log.debug(`Block ${blockId} is not valid, resync.`)
      await blocksService.processBlock(blockId)
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

const getBlockIdHash = async (blockId: number) => {
  const { polkadotConnector } = app
  const block = await getBlockFromDB(blockId)

  if (!block) {
    return await polkadotConnector.rpc.chain.getBlockHash(blockId)
  } else {
    return block.hash
  }
}

const verifyEraOfBlockId = async (blockId: number) => {
  const { polkadotConnector } = app

  const blockHash = await getBlockIdHash(blockId)

  const blockEra = +(await polkadotConnector.query.staking.currentEra.at(blockHash)).toString()

  const isEraChanged = blockEra > getCurrentEra()

  if (!isEraChanged) return

  setCurrentEra(blockEra)

  app.log.debug(`Validate era ${blockEra}`)

  const delayedEra = blockEra - ERA_DELAY_OFFSET

  const isDelayedEraExists = delayedEra >= 0
  if (!isDelayedEraExists) return

  const eraFromDB = await getEraFromDB(delayedEra)

  const resyncEra = async (eraId: number, blockHash: string | BlockHash) => {
    // stakingService.extractStakers(eraId, blockHash)
  }

  if (!eraFromDB) {
    app.log.debug(`Era is not exists in DB: ${delayedEra}, resync`)
    try {
      await resyncEra(delayedEra, blockHash)
      return
    } catch (error) {
      app.log.error(`error whan trying to resync era ${delayedEra}`)
    }
  }

  // const [sessionId, blockTime] = await Promise.all([
  //   polkadotConnector.query.session.currentIndex.at(blockHash),
  //   polkadotConnector.query.timestamp.now.at(blockHash)
  // ])

  // const stakingData = await stakingService.getValidators(blockHash, sessionId, blockTime, delayedEra)

  // interface IEraData {
  //   validators_active: number
  //   nominators_active: number
  // }

  // const isEraDataValid = (eraFromDB: IEra, eraData: IEraData): boolean => {
  //   return eraData.validators_active === eraFromDB.validators_active && eraData.nominators_active === eraFromDB.nominators_active
  // }

  // if (!isEraDataValid(eraFromDB, stakingData.era_data)) {
  //   app.log.debug(`Era in DB is not equals data from api: ${blockId}, resync`)
  //   try {
  //     await resyncEra(delayedEra, blockHash)
  //     return
  //   } catch (error) {
  //     app.log.error(`Error when trying to resync era ${delayedEra}`)
  //   }
  // }

  // app.log.debug(`Era ${eraFromDB.era} is correct`)
}

const isStartHeightValid = async (startBlockId: number): Promise<boolean> => {
  const watchdogVerifyHeight = await configService.getConfigValueFromDB('watchdog_verify_height')
  app.log.debug(`Current db watchdog_verify_height = ${watchdogVerifyHeight}`)

  return startBlockId >= 0 && startBlockId - 1 <= +watchdogVerifyHeight
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

interface IWatchdogStatus {
  status: VerifierStatus
  current_height: number
  finished_at: string | undefined
}

/**
 * invoked by REST /api/watchdog/status request
 */
export const getStatus = async (): Promise<IWatchdogStatus> => {
  const result = {
    status,
    current_height: lastCheckedBlockId,
    last_era_checked: currentEraId - ERA_DELAY_OFFSET,
    finished_at: undefined
  }

  if (getWatchdogStatus() !== VerifierStatus.IDLE) return result

  const finished_at = await configService.getConfigValueFromDB('watchdog_finished_at')

  return { ...result, finished_at }
}

interface IWatchdogRestartResponse {
  result: boolean
}

/**
 * Invoked by /api/wathchdog/restart/:blockId REST request
 */
export const restartFromBlockId = async (newStartBlockId: number): Promise<IWatchdogRestartResponse> => {
  const isStartBlockValid = await isStartHeightValid(newStartBlockId)

  if (!isStartBlockValid) {
    return {
      result: false
    }
  }

  if (getWatchdogStatus() === VerifierStatus.IDLE) {
    // this resolve was saved as "global" object when all blocks verified
    resolve(newStartBlockId - 1)
  } else {
    restartBlockId = newStartBlockId - 1
    setWatchdogStatus(VerifierStatus.RESTART)
  }

  return { result: true }
}

const isDBEmpty = async () => {
  const { postgresConnector } = app
  try {
    const { rows } = await postgresConnector.query({
      text: `SELECT count (*) FROM ${DB_SCHEMA}.blocks`
    })
    const blocksInDBCount = +rows[0].count

    return blocksInDBCount === 0
  } catch (err) {
    app.log.error(`Error check is db empty`)
    throw new Error('Error check is db empty')
  }
}

const isStartParamsValid = async (startBlockId: number) => {
  const isStartBlockValid = await isStartHeightValid(startBlockId)

  if (!isStartBlockValid) {
    app.log.error(`Attempt to run verification with blockId ${startBlockId} greater than current watchdog_verify_height. Exit with error.`)
    return false
  }

  const dbEmptyCheck = await isDBEmpty()

  if (dbEmptyCheck) {
    app.log.error('Blocks table in DB is empty, exit')
    return false
  }
  return true
}
/**
 * Main method invoked by runner on service start
 * Consists infinite loop, sleeping in IDLE mode when all blocks verified
 * could be rewinded by /api/watchdog/restart/:blockId REST request
 */
export const run = async (startBlockId: number | undefined): Promise<void> => {
  const { polkadotConnector } = app
  await configService.updateConfigValueInDB('watchdog_started_at', Date.now())

  if (!startBlockId) {
    const watchdogVerifyHeight = await configService.getConfigValueFromDB('watchdog_verify_height')
    startBlockId = +watchdogVerifyHeight + 1
  }

  const isStartValid = await isStartParamsValid(startBlockId)

  if (!isStartValid) {
    app.log.error('Starting conditions is not valid, exit')
    process.exit(0)
  }

  app.log.info(`Watchdog start from blockId ${startBlockId}`)

  lastCheckedBlockId = startBlockId - 1

  const getLastCheckedEra = async (lastCheckedBlockId: number): Promise<number> => {
    if (lastCheckedBlockId >= 0) {
      const lastCheckedBlockHash = await getBlockIdHash(lastCheckedBlockId)
      const lastCheckedEra = +(await polkadotConnector.query.staking.currentEra.at(lastCheckedBlockHash)).toString()
      return lastCheckedEra
    }
    return -1
  }

  const lastCheckedEra = await getLastCheckedEra(lastCheckedBlockId)
  setCurrentEra(lastCheckedEra)

  setWatchdogStatus(VerifierStatus.RUNNING)

  while (true) {
    const blocksToCheck = await getNextBlockIdInterval(lastCheckedBlockId)

    await Promise.all([...blocksToCheck.map((blockId) => verifyBlock(blockId)), verifyEraOfBlockId(blocksToCheck[0])])

    lastCheckedBlockId = blocksToCheck[blocksToCheck.length - 1]

    await configService.updateConfigValueInDB('watchdog_verify_height', lastCheckedBlockId)

    // will sleep here if all blocks verified
    lastCheckedBlockId = await updateLastCheckedBlockIdIfRestartOrBlocksEnd(lastCheckedBlockId)
  }
}

/**
 * Init method invoked by runner.ts on startup
 */
export const init = (appParam: FastifyInstance, concurrencyParam: number): void => {
  concurrency = concurrencyParam
  setWatchdogStatus(VerifierStatus.NEW)
  app = appParam
  blocksService = new BlocksService(app)
  configService = new ConfigService(app)
}

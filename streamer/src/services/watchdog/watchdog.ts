import { environment } from '../../environment'
import { IBlock, IEra, VerifierStatus, IWatchdogService, IWatchdogStatus, IWatchdogRestartResponse } from './watchdog.types'
import { StakingService } from '../staking/staking'
import { ConfigService } from '../config/config'
import { BlocksService } from '../blocks/blocks'
import { EventRecord, SignedBlock } from '@polkadot/types/interfaces'
import { Pool } from 'pg'
import { Vec } from '@polkadot/types'
import { PostgresModule } from '../../modules/postgres.module'
import { PolkadotModule } from '../../modules/polkadot.module'
import { ILoggerModule, LoggerModule } from '../../modules/logger.module'
import { BlockRepository } from '../../repositories/block.repository'

const { DB_SCHEMA } = environment

const WATCHDOG_CONCURRENCY = 10

export default class WatchdogService implements IWatchdogService {
  static instance: WatchdogService

  private readonly blockRepository: BlockRepository = BlockRepository.inject()
  private readonly repository: Pool = PostgresModule.inject()
  private readonly polkadotApi: PolkadotModule = PolkadotModule.inject()
  private readonly logger: ILoggerModule = LoggerModule.inject()

  private resolve: { (arg0: number): void; (value: number | PromiseLike<number>): void } | undefined
  private concurrency: number
  private status: VerifierStatus
  private readonly blocksService: BlocksService
  private readonly configService: ConfigService
  private currentEraId: number
  private lastCheckedBlockId: number
  private restartBlockId: number

  constructor() {
    this.concurrency = WATCHDOG_CONCURRENCY
    this.status = VerifierStatus.NEW
    this.blocksService = new BlocksService()
    this.configService = new ConfigService()
    this.currentEraId = -1
    this.lastCheckedBlockId = -1
    this.restartBlockId = -1
  }

  static getInstance(): WatchdogService {
    if (!WatchdogService.instance) {
      WatchdogService.instance = new WatchdogService()
    }

    return WatchdogService.instance
  }

  /**
   * Main method invoked by runner on service start
   * Consists infinite loop, sleeping in IDLE mode when all blocks verified
   * could be rewinded by /api/watchdog/restart/:blockId REST request
   */
  async run(startBlockId: number | undefined): Promise<void> {
    await this.configService.updateConfigValueInDB('watchdog_started_at', Date.now())

    if (!startBlockId) {
      const watchdogVerifyHeight = (await this.configService.getConfigValueFromDB('watchdog_verify_height')) || -1
      startBlockId = +watchdogVerifyHeight + 1
    }

    const isStartValid = await this.isStartParamsValid(startBlockId)

    if (!isStartValid) {
      this.logger.error('Starting conditions is not valid, exit')
      process.exit(0)
    }

    this.logger.info(`Watchdog start from blockId ${startBlockId}`)

    this.lastCheckedBlockId = startBlockId - 1

    this.status = VerifierStatus.RUNNING

    while (true) {
      const blocksToCheck = await this.getNextBlockIdInterval(this.lastCheckedBlockId)

      await Promise.all(blocksToCheck.map((blockId) => this.verifyBlock(blockId)))

      this.lastCheckedBlockId = blocksToCheck[blocksToCheck.length - 1]

      await this.configService.updateConfigValueInDB('watchdog_verify_height', this.lastCheckedBlockId)

      // will sleep here if all blocks verified
      this.lastCheckedBlockId = await this.updateLastCheckedBlockIdIfRestartOrBlocksEnd(this.lastCheckedBlockId)
    }
  }

  async verifyBlock(blockId: number): Promise<void> {
    this.logger.info(`Watchdog verify block ${blockId}`)
    const blockFromDB = await this.getBlockFromDB(blockId)

    if (!blockFromDB) {
      this.logger.info(`Block is not exists in DB: ${blockId}`)
      await this.blocksService.processBlock(blockId)
      return
    }

    const blockFromChain = await this.polkadotApi.getBlockData(blockFromDB.hash)

    this.logger.info(`Validate block ${blockId}`)

    const isBlockValidResult = await this.isBlockValid(blockFromDB, blockFromChain)

    if (!isBlockValidResult) {
      try {
        this.logger.info(`Block ${blockId} is not valid, resync.`)
        await this.blocksService.processBlock(blockId)
        return
      } catch (error) {
        this.logger.error({ error }, `error in blocksService.processBlock invocation when try to resync missed events for block ${blockId}`)
      }
    }

    this.validateEraPayout(blockFromDB)
  }

  async getEraFromDB(eraId: number): Promise<IEra> {
    try {
      const { rows } = await this.repository.query({
        text: `SELECT * FROM ${DB_SCHEMA}.eras WHERE "era" = $1::int`,
        values: [eraId]
      })

      return rows[0]
    } catch (err) {
      this.logger.error({ err }, `failed to get era by id ${eraId}`)
      throw new Error(`cannot get era by id ${eraId}`)
    }
  }

  async getEraStakingDiff(eraId: number): Promise<any> {
    try {
      const { rows } = await this.repository.query({
        text: `select e.era as era, e.total_stake  - sum(v.total) as diff from ${DB_SCHEMA}.eras e 
  join ${DB_SCHEMA}.validators v
  on v.era = e.era
  where e.era = $1::int
  group by e.era`,
        values: [eraId]
      })

      return rows[0]
    } catch (err) {
      this.logger.error({ err }, `failed to get staking diff by id ${eraId}`)
      throw new Error(`failed to get staking diff by id ${eraId}`)
    }
  }

  async validateEraPayout(blockFromDB: IBlock): Promise<void> {
    const events = await this.polkadotApi.getSystemEvents(blockFromDB.hash)

    const findEraPayoutEvent = (events: Vec<EventRecord>) => {
      return events.find((event) => event.event.section === 'staking' && event.event.method === 'EraPayout')
    }

    const eraPayoutEvent = findEraPayoutEvent(events)

    if (!eraPayoutEvent) {
      return
    }

    const [eraId] = eraPayoutEvent.event.data

    const eraFromDb = await this.getEraFromDB(+eraId)

    if (!eraFromDb) {
      StakingService.inject().addToQueue({ eraPayoutEvent, blockHash: blockFromDB.hash })
      return
    }

    const diff = await this.getEraStakingDiff(+eraId)

    if (+diff.diff !== 0) {
      this.logger.info(`Era staking diff is not zero: ${+diff.diff}. Resync era ${eraId}.`)
      StakingService.inject().addToQueue({ eraPayoutEvent, blockHash: blockFromDB.hash })
    }
  }

  async isBlockValid(blockFromDB: IBlock, blockFromChain: SignedBlock): Promise<boolean> {
    const isEventsExists = await this.isEventsExist(blockFromDB)
    const isExtrinsicsExists = await this.isExtrinsicsExist(blockFromDB, blockFromChain)
    const isParentHashValid = blockFromDB.parent_hash === blockFromChain.block.header.parentHash.toString()

    if (!isEventsExists || !isExtrinsicsExists || !isParentHashValid) {
      this.logger.info(`Events or extrinsics is not exist in DB for block ${blockFromDB.id}`)
      return false
    }

    return true
  }

  async isEventsExist(block: IBlock): Promise<boolean> {
    try {
      const {
        rows: [{ count }]
      } = await this.repository.query({
        text: `SELECT count(*) FROM ${DB_SCHEMA}.events WHERE "block_id" = $1::int`,
        values: [block.id]
      })

      const eventsInBlockchainCount = await this.polkadotApi.getSystemEventsCount(block.hash)

      return +count === eventsInBlockchainCount.toNumber()
    } catch (err) {
      this.logger.error({ err }, `failed to get events for block ${block.id}`)
      throw new Error(`cannot check events for block ${block.id}`)
    }
  }

  /**
   * invoked by REST /api/watchdog/status request
   */
  async getStatus(): Promise<IWatchdogStatus> {
    const result = {
      status: this.status,
      current_height: this.lastCheckedBlockId,
      finished_at: undefined
    }

    if (this.status !== VerifierStatus.IDLE) return result

    const finished_at = await this.configService.getConfigValueFromDB('watchdog_finished_at')

    return { ...result, finished_at }
  }

  /**
   * Invoked by /api/wathchdog/restart/:blockId REST request
   */
  async restartFromBlockId(newStartBlockId: number): Promise<IWatchdogRestartResponse> {
    const isStartBlockValid = await this.isStartHeightValid(newStartBlockId)

    if (!isStartBlockValid) {
      return {
        result: false
      }
    }

    if (this.status === VerifierStatus.IDLE) {
      // this resolve was saved as "global" object when all blocks verified
      this.resolve!(newStartBlockId - 1)
    } else {
      this.restartBlockId = newStartBlockId - 1
      this.status = VerifierStatus.RESTART
    }

    return { result: true }
  }

  async getBlockFromDB(blockId: number): Promise<IBlock> {
    try {
      const { rows } = await this.repository.query({
        text: `SELECT * FROM ${DB_SCHEMA}.blocks WHERE "id" = $1::int`,
        values: [blockId]
      })

      return rows[0]
    } catch (err) {
      this.logger.error({ err }, `failed to get block by id ${blockId}`)
      throw new Error('cannot getblock by id')
    }
  }

  async isStartParamsValid(startBlockId: number): Promise<boolean> {
    const isStartBlockValid = await this.isStartHeightValid(startBlockId)

    if (!isStartBlockValid) {
      this.logger.error(
        `Attempt to run verification with blockId ${startBlockId} greater than current watchdog_verify_height. Exit with error.`
      )
      return false
    }

    const dbEmptyCheck = await this.isDBEmpty()

    if (dbEmptyCheck) {
      this.logger.error('Blocks table in DB is empty, exit')
      return false
    }
    return true
  }

  async isDBEmpty(): Promise<boolean> {
    try {
      const { rows } = await this.repository.query({
        text: `SELECT count (*) FROM ${DB_SCHEMA}.blocks`
      })
      const blocksInDBCount = +rows[0].count

      return blocksInDBCount === 0
    } catch (err) {
      this.logger.error({ err }, `Error check isDBEmpty`)
      throw new Error('Error check isDBEmpty')
    }
  }

  async getNextBlockIdInterval(currentBlockId: number): Promise<Array<number>> {
    const nextBlocksCount = await this.getNextBlocksCount(currentBlockId)

    return Array(nextBlocksCount)
      .fill('')
      .map((_, i) => currentBlockId + i + 1)
  }

  async getNextBlocksCount(currentBlockId: number): Promise<number> {
    const lastProcessedBlockId = await this.blockRepository.getLastProcessedBlock()

    if (lastProcessedBlockId - currentBlockId > this.concurrency) return this.concurrency
    return lastProcessedBlockId - currentBlockId
  }

  async updateLastCheckedBlockIdIfRestartOrBlocksEnd(lastCheckedBlockId: number): Promise<number> {
    const lastProcessedBlockId = await this.blockRepository.getLastProcessedBlock()

    const isLastBlock = () => lastCheckedBlockId === lastProcessedBlockId

    if (isLastBlock()) {
      this.status = VerifierStatus.IDLE
      await this.configService.updateConfigValueInDB('watchdog_finished_at', Date.now())
      return new Promise((resolveLink) => {
        this.resolve = resolveLink
      })
    }

    const resultBlockId = this.status === VerifierStatus.RESTART ? this.restartBlockId : lastCheckedBlockId

    this.status = VerifierStatus.RUNNING

    return resultBlockId
  }

  async isStartHeightValid(startBlockId: number): Promise<boolean> {
    const watchdogVerifyHeight = (await this.configService.getConfigValueFromDB('watchdog_verify_height')) || -1
    this.logger.info(`Current db watchdog_verify_height = ${watchdogVerifyHeight}`)

    return startBlockId >= 0 && startBlockId - 1 <= +watchdogVerifyHeight
  }

  async isExtrinsicsExist(block: IBlock, blockFromChain: SignedBlock): Promise<boolean> {
    try {
      const {
        rows: [{ count }]
      } = await this.repository.query({
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
      this.logger.error({ err }, `failed to get extrinsics for block ${block.id}`)
      throw new Error(`cannot check extrinsics for block ${block.id}`)
    }
  }
}

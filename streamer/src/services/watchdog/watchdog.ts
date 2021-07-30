import { IBlock, IWatchdogRestartResponse, IWatchdogService, IWatchdogStatus, VerifierStatus } from './watchdog.types'
import { StakingService } from '../staking'
import { ConfigService } from '../config'
import { BlocksService } from '../blocks'
import { EventRecord, SignedBlock } from '@polkadot/types/interfaces'
import { Vec } from '@polkadot/types'
import { PolkadotModule } from '@modules/polkadot.module'
import { ILoggerModule, LoggerModule } from '@modules/logger.module'
import { BlockRepository } from '@repositories/block.repository'
import { EraRepository } from '@repositories/era.repository'
import { EventRepository } from '@repositories/event.repository'
import { ExtrinsicRepository } from '@repositories/extrinsic.repository'

const WATCHDOG_CONCURRENCY = 10

export class WatchdogService implements IWatchdogService {
  static instance: WatchdogService

  private readonly blockRepository: BlockRepository = BlockRepository.inject()
  private readonly eraRepository: EraRepository = new EraRepository()
  private readonly eventRepository: EventRepository = new EventRepository()
  private readonly extrinsicRepository: ExtrinsicRepository = new ExtrinsicRepository()
  private readonly polkadotApi: PolkadotModule = PolkadotModule.inject()
  private readonly logger: ILoggerModule = LoggerModule.inject()

  private concurrency: number
  private status: VerifierStatus
  private readonly blocksService: BlocksService
  private readonly configService: ConfigService
  private currentEraId: number
  private lastCheckedBlockId: number
  private restartBlockId: number
  private iterator: AsyncGenerator<unknown, never, number>

  constructor() {
    this.concurrency = WATCHDOG_CONCURRENCY
    this.status = VerifierStatus.NEW
    this.blocksService = BlocksService.inject()
    this.configService = new ConfigService()
    this.currentEraId = -1
    this.lastCheckedBlockId = -1
    this.restartBlockId = -1
    this.iterator = this.watchdogGenerate()
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
    await this.iterator.next()
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
      this.iterator.next(newStartBlockId - 1)
    } else {
      this.restartBlockId = newStartBlockId - 1
      this.status = VerifierStatus.RESTART
    }

    return { result: true }
  }

  private async *watchdogGenerate(): AsyncGenerator<unknown, never, number> {
    while (true) {
      const blocksToCheck = await this.getNextBlockIdInterval(this.lastCheckedBlockId)

      await Promise.all(blocksToCheck.map((blockId) => this.verifyBlock(blockId)))

      this.lastCheckedBlockId = blocksToCheck[blocksToCheck.length - 1]

      await this.configService.updateConfigValueInDB('watchdog_verify_height', this.lastCheckedBlockId)

      if (this.lastCheckedBlockId === (await this.blockRepository.getLastProcessedBlock())) {
        this.status = VerifierStatus.IDLE
        await this.configService.updateConfigValueInDB('watchdog_finished_at', Date.now())

        this.lastCheckedBlockId = yield
      } else if (this.status === VerifierStatus.RESTART) {
        this.lastCheckedBlockId = this.restartBlockId
        this.status = VerifierStatus.RUNNING
      }
    }
  }

  private async verifyBlock(blockId: number): Promise<void> {
    this.logger.info(`Watchdog verify block ${blockId}`)
    const blockFromDB = await this.blockRepository.getBlockById(blockId)

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

  private async validateEraPayout(blockFromDB: IBlock): Promise<void> {
    const events = await this.polkadotApi.getSystemEvents(blockFromDB.hash)

    const findEraPayoutEvent = (events: Vec<EventRecord>) => {
      return events.find((event) => event.event.section === 'staking' && event.event.method === 'EraPayout')
    }

    const eraPayoutEvent = findEraPayoutEvent(events)

    if (!eraPayoutEvent) {
      return
    }

    const [eraId] = eraPayoutEvent.event.data

    const eraFromDb = await this.eraRepository.getEra(+eraId)

    if (!eraFromDb) {
      StakingService.inject().addToQueue({ eraId: eraId?.toString(), blockHash: blockFromDB.hash })
      return
    }

    const diff = await this.eraRepository.getEraStakingDiff(+eraId)

    if (+diff.diff !== 0) {
      this.logger.debug(`Era staking diff is not zero: ${+diff.diff}. Resync era ${eraId}.`)
      StakingService.inject().addToQueue({ eraId: eraId?.toString(), blockHash: blockFromDB.hash })
    }
  }

  private async isBlockValid(blockFromDB: IBlock, blockFromChain: SignedBlock): Promise<boolean> {
    const isEventsExists = await this.isEventsExist(blockFromDB)
    const isExtrinsicsExists = await this.isExtrinsicsExist(blockFromDB, blockFromChain)
    const isParentHashValid = blockFromDB.parent_hash === blockFromChain.block.header.parentHash.toString()

    if (!isEventsExists || !isExtrinsicsExists || !isParentHashValid) {
      this.logger.info(`Events or extrinsics is not exist in DB for block ${blockFromDB.id}`)
      return false
    }

    return true
  }

  private async isEventsExist(block: IBlock): Promise<boolean> {
    try {
      const count = this.eventRepository.getEventCountByBlock(parseInt(block.id))

      const eventsInBlockchainCount = await this.polkadotApi.getSystemEventsCount(block.hash)

      return +count === eventsInBlockchainCount.toNumber()
    } catch (err) {
      this.logger.error({ err }, `failed to get events for block ${block.id}`)
      throw new Error(`cannot check events for block ${block.id}`)
    }
  }

  private async isStartParamsValid(startBlockId: number): Promise<boolean> {
    const isStartBlockValid = await this.isStartHeightValid(startBlockId)

    if (!isStartBlockValid) {
      this.logger.error(
        `Attempt to run verification with blockId ${startBlockId} greater than current watchdog_verify_height. Exit with error.`
      )
      return false
    }

    const dbEmptyCheck = await this.blockRepository.isEmpty()

    if (dbEmptyCheck) {
      this.logger.error('Blocks table in DB is empty, exit')
      return false
    }
    return true
  }

  private async getNextBlockIdInterval(currentBlockId: number): Promise<Array<number>> {
    const nextBlocksCount = await this.getNextBlocksCount(currentBlockId)

    return Array(nextBlocksCount)
      .fill('')
      .map((_, i) => currentBlockId + i + 1)
  }

  private async getNextBlocksCount(currentBlockId: number): Promise<number> {
    const lastProcessedBlockId = await this.blockRepository.getLastProcessedBlock()

    if (lastProcessedBlockId - currentBlockId > this.concurrency) return this.concurrency
    return lastProcessedBlockId - currentBlockId
  }

  private async isStartHeightValid(startBlockId: number): Promise<boolean> {
    const watchdogVerifyHeight = (await this.configService.getConfigValueFromDB('watchdog_verify_height')) || -1
    this.logger.info(`Current db watchdog_verify_height = ${watchdogVerifyHeight}`)

    return startBlockId >= 0 && startBlockId - 1 <= +watchdogVerifyHeight
  }

  private async isExtrinsicsExist(block: IBlock, blockFromChain: SignedBlock): Promise<boolean> {
    try {
      const count = this.extrinsicRepository.getExtrinsicsCountByBlock(parseInt(block.id))

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

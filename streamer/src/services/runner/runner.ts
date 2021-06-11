import { IRunnerService } from './runner.types'
import { IBlocksService, BlocksService } from '../blocks'
import { IConfigService, ConfigService } from '../config'
import { IWatchdogService, WatchdogService } from '../watchdog/'
import { IConsumerService, ConsumerService } from '../consumer'

/**
 * Provides cli operations
 * @class
 */
class RunnerService implements IRunnerService {
  private readonly blocksService: IBlocksService
  private readonly consumerService: IConsumerService
  private readonly configService: IConfigService
  private readonly watchdogService: IWatchdogService

  constructor() {
    this.blocksService = new BlocksService()
    this.consumerService = new ConsumerService()
    this.configService = new ConfigService()
    this.watchdogService = WatchdogService.getInstance()
  }

  /**
   * Run synchronization blocks
   *
   * @async
   * @param {SyncOptions} options
   * @returns {Promise<void>}
   */
  async sync(options: Parameters<IRunnerService['sync']>[0]): Promise<void> {
    await this.configService.bootstrapConfig()

    if (options.optionSync || options.optionSyncForce) {
      const startBlock: number | undefined = options.optionSyncForce ? 0 : options.optionSyncStartBlockNumber
      this.blocksService.processBlocks(startBlock, options.optionSubscribeFinHead)
      return
    }

    if (options.optionSubscribeFinHead) {
      this.consumerService.subscribeFinalizedHeads()
      return
    }

    if (options.optionStartWatchdog) {
      this.watchdogService.run(options.optionWatchdogStartBlockNumber)
    }
  }
}

export { RunnerService }

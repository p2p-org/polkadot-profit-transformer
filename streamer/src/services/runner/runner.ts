import { IRunnerService } from './runner.types'
import { IBlocksService, BlocksService } from '@services/blocks'
import { IConfigService, ConfigService } from '@services/config'
import { IWatchdogService, WatchdogService } from '@services/watchdog/'
import { IConsumerService, ConsumerService } from '@services/consumer'

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
    this.blocksService = BlocksService.inject()
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
      await this.blocksService.processBlocks(startBlock, options.optionSubscribeFinHead)
      return
    }

    if (options.optionSubscribeFinHead) {
      await this.consumerService.subscribeFinalizedHeads()
      return
    }

    if (options.optionStartWatchdog) {
      await this.watchdogService.run(options.optionWatchdogStartBlockNumber)
      return
    }
  }
}

export { RunnerService }

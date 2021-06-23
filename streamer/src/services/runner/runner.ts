import { IRunnerService } from './runner.types'
import { IBlocksService } from '../blocks/blocks.types'
import { IConfigService } from '../config/config.types'
import { IWatchdogService } from '../watchdog/watchdog.types'
import { IConsumerService } from '../consumer/consumer.types'

import WatchdogService from '../watchdog/watchdog'

import { ConfigService } from '../config/config'
import { ConsumerService } from '../consumer/consumer'
import { BlocksService } from '../blocks/blocks'

/**
 * Provides cli operations
 * @class
 */
class RunnerService implements IRunnerService {
  private readonly blocksService: IBlocksService = new BlocksService()
  private readonly consumerService: IConsumerService = new ConsumerService()
  private readonly configService: IConfigService = new ConfigService()
  private readonly watchdogService: IWatchdogService = WatchdogService.getInstance()

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

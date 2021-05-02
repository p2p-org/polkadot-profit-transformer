import { IRunnerService } from './runner.types'
import { IBlocksService } from '../blocks/blocks.types'
import { IConfigService } from '../config/config.types'
import { IWatchdogService } from '../watchdog/watchdog.types'
import { IConsumerService } from '../consumer/consumer.types'

import WatchdogService from '../watchdog/watchdog'

const { ConfigService } = require('../config/config')
const { ConsumerService } = require('../consumer/consumer')
const { BlocksService } = require('../blocks/blocks')

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

    if (options.optionSync) {
      this.blocksService.processBlocks(options.optionSyncStartBlockNumber)
    }

    if (options.optionSyncForce) {
      await this.blocksService.processBlocks(options.optionSyncStartBlockNumber)
    }

    if (options.optionSubscribeFinHead) {
      await this.consumerService.subscribeFinalizedHeads()
    }

    if (options.optionStartWatchdog) {
      this.watchdogService.run(options.optionWatchdogStartBlockNumber)
    }
  }
}

export { RunnerService }

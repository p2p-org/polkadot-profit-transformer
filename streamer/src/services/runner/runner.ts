import { IRunnerService } from './runner.types'
import { FastifyInstance } from 'fastify'
import { IBlocksService } from '../blocks/blocks.types'
import { IStakingService } from '../staking/staking.types'
import { IConfigService } from '../config/config.types'
import { IConsumerService } from '../consumer/consumer.types'

import { init as watchdogInit, run as watchdogRun } from '../watchdog/watchdog'

const { ConfigService } = require('../config/config')
const { ConsumerService } = require('../consumer/consumer')
const { BlocksService } = require('../blocks/blocks')
const { StakingService } = require('../staking/staking')

/**
 * Provides cli operations
 * @class
 */
class RunnerService implements IRunnerService {
  private readonly app: FastifyInstance

  private readonly blocksService: IBlocksService
  private readonly consumerService: IConsumerService
  private readonly stakingService: IStakingService
  private readonly configService: IConfigService

  constructor(app: FastifyInstance) {
    /** @private */
    this.app = app

    /** @private */
    this.blocksService = new BlocksService(app)

    /** @private */
    this.consumerService = new ConsumerService(app)

    /** @private */
    this.stakingService = new StakingService(app)

    /** @private */
    this.configService = new ConfigService(app)
  }

  /**
   * Synchronization jobs options
   *
   * @typedef {Object} SyncOptions
   * @property {boolean} optionSync
   * @property {boolean} optionSyncForce
   * @property {boolean} optionSyncValidators
   * @property {number} optionSyncStartBlockNumber
   * @property {boolean} optionSubscribeFinHead
   */

  /**
   * Run synchronization blocks
   *
   * @async
   * @param {SyncOptions} options
   * @returns {Promise<void>}
   */
  async sync(options: Parameters<IRunnerService['sync']>[0]): Promise<void> {
    await this.configService.bootstrapConfig()

    if (options.optionSyncValidators) {
      await this.stakingService.syncValidators(options.optionSyncStartBlockNumber)
      return
    }

    if (options.optionSync) {
      await this.blocksService.processBlocks(options.optionSyncStartBlockNumber)
    }

    if (options.optionSyncForce) {
      await this.blocksService.processBlocks(options.optionSyncStartBlockNumber)
    }

    if (options.optionSubscribeFinHead) {
      await this.consumerService.subscribeFinalizedHeads()
    }

    if (options.optionStartWatchdog) {
      watchdogInit(this.app, options.optionWatchdogConcurrency)
      watchdogRun(options.optionWatchdogStartBlockNumber)
    }
  }
}

export { RunnerService }

const { ConfigService } = require('./config')
const { ConsumerService } = require('./consumer')
const { BlocksService } = require('./blocks')
const { StakingService } = require('./staking/staking')

/**
 * Provides cli operations
 * @class
 */
class RunnerService {
  constructor(app) {
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
  async sync(options) {
    await this.configService.bootstrapConfig()

    if (options.optionSyncValidators) {
      await this.stakingService.syncValidators(options.optionSyncStartBlockNumber)
    } else {
      if (options.optionSync) {
        await this.blocksService.processBlocks(options.optionSyncStartBlockNumber)
      } else if (options.optionSyncForce) {
        await this.blocksService.processBlocks(options.optionSyncStartBlockNumber)
      }

      if (options.optionSubscribeFinHead) {
        await this.consumerService.subscribeFinalizedHeads()
      }
    }
  }
}

module.exports = {
  RunnerService: RunnerService
}

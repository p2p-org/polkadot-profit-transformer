const {ConsumerService} = require("./consumer");
const {BlocksService} = require("./blocks")


/**
 * Provides cli operations
 * @class
 */
class RunnerService {

    constructor(app) {
        /** @private */
        this.app = app;

        /** @private */
        this.blocksService = new BlocksService(app);

        /** @private */
        this.consumerService = new ConsumerService(app);
    }

    /**
     * Synchronization jobs options
     *
     * @typedef {Object} SyncOptions
     * @property {boolean} optionSync
     * @property {boolean} optionSyncForce
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
        if (options.optionSync) {
            await this.blocksService.processBlocks()
        } else if (options.optionSyncForce) {
            await this.blocksService.processBlocks(0)
        }

        if (options.optionSubscribeFinHead) {
            await this.consumerService.subscribeFinalizedHeads()
        }
    }

}

module.exports = {
    RunnerService: RunnerService
};
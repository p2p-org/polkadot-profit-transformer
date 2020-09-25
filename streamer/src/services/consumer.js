const {SyncStatus} = require("./index");
const {BlocksService} = require("./blocks")
const defaultExport = require('@polkadot/types');


/**
 * Provides blocks streamer service
 * @class
 */
class ConsumerService {

    /**
     * Creates an instance of ConsumerService.
     * @constructor
     * @param {object} app - The fastify instance object
     */
    constructor(app) {
        /** @private */
        this.app = app;

        /** @private */
        const {polkadotConnector} = this.app;

        if (!polkadotConnector) {
            throw new Error('cant get .polkadotConnector from fastify app.');
        }
    }

    /**
     * Subscribe to finalized heads stream
     *
     * @async
     * @returns {Promise<void>}
     */
    async subscribeFinalizedHeads() {

        const {polkadotConnector} = this.app;

        if (SyncStatus.isLocked()) {
            this.app.log.error(`failed setup "subscribeFinalizedHeads": sync in process`);
            return
        }

        this.app.log.info(`Starting subscribeFinalizedHeads`);

        const blocksService = new BlocksService(this.app);

        const blockNumberFromDB = await blocksService.getLastProcessedBlock();

        if (blockNumberFromDB == 0) {
            this.app.log.warn(`"subscribeFinalizedHeads" capture enabled but, not synchronized blocks `);
        }

        polkadotConnector.rpc.chain.subscribeFinalizedHeads(header => {
            return this.onFinalizedHead(header);
        });
    }

    /**
     * Finalized headers capture handler
     *
     * @async
     * @private
     * @param {BlockHash} blockHash
     * @returns {Promise<void>}
     */
    async onFinalizedHead(blockHash) {
        const blocksService = new BlocksService(this.app);

        const blockNumberFromDB = await blocksService.getLastProcessedBlock();

        if (blockHash.number.toNumber() == blockNumberFromDB) {
            return
        }

        this.app.log.info(`Captured block "${blockHash.number}" with hash ${blockHash.hash}`);


        if (blockHash.number.toNumber() < blockNumberFromDB) {
            this.app.log.info(`stash operation detected`);
            await blocksService.trimAndUpdateToFinalized(blockHash.number.toNumber())
        }

        blocksService.processBlock(blockHash.number.toNumber()).catch((error) => {
            this.app.log.error(`failed to process captured block #${blockHash}:`, error);
        });
    }


}

module.exports = {
    ConsumerService: ConsumerService
};
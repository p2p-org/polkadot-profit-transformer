const {SyncStatus} = require("./index");
const defaultExport = require('@polkadot/types');

/** @type {BlockHash | string | Uint8Array} */
let currentSpecVersion = null

/**
 * Provides block operations
 * @class
 */
class BlocksService {

    /**
     * Creates an instance of BlocksService.
     * @param {object} app fastify app
     */
    constructor(app) {

        if (!app.ready) throw new Error(`can't get .ready from fastify app.`);

        /** @private */
        this.app = app;

        const {polkadotConnector} = this.app;

        if (!polkadotConnector) {
            throw new Error('cant get .polkadotConnector from fastify app.');
        }

        /** @type {u32} */
        this.currentSpecVersion = polkadotConnector.createType('u32', 0);

        const {kafkaConnector} = this.app;

        if (!kafkaConnector) {
            throw new Error('cant get .kafkaConnector from fastify app.');
        }

        const {postgresConnector} = this.app

        if (!postgresConnector) {
            throw new Error('cant get .postgresConnector from fastify app.');
        }

        postgresConnector.connect((err, client, release) => {
            if (err) {
                throw new Error('Error acquiring client');
            }
            client.query('SELECT NOW()', (err, result) => {
                release()
                if (err) {
                    throw new Error('Error executing query ' + err.toString());
                }
            })
        })
    }

    /**
     * Update one block
     *
     * @public
     * @async
     * @param {number} blockNumber
     * @returns {Promise<boolean>}
     */
    async updateOneBlock(blockNumber) {

        const {polkadotConnector} = this.app;

        if (SyncStatus.isLocked()) {
            this.app.log.error(`failed execute "updateOneBlock": sync in process`);
            throw new Error("sync in process")
        }

        await this.processBlock(blockNumber).catch((error) => {
            this.app.log.error(`failed to process block #${blockNumber}:`, error);
            throw new Error("cannot process block")
        });
        return true;
    }

    /**
     * Update one block
     *
     * @private
     * @async
     * @param {number} height
     * @param {BlockHash} blockHash
     * @returns {Promise}
     */
    async processBlock(height, blockHash = null) {

        const {polkadotConnector} = this.app;

        if (blockHash == null) {
            if (height == null) {
                throw new Error("empty height and blockHash")
            }

            blockHash = await polkadotConnector.rpc.chain.getBlockHash(height);

            if (!blockHash) {
                throw new Error('cannot get block hash');
            }
        }

        await this.updateMetaData(blockHash);

        let block_events = [];

        const events = await polkadotConnector.query.system.events.at(blockHash);
        events.forEach((record) => {
            const {event, phase} = record;
            const types = event.typeDef;

            let block_event = {
                "section": event.section,
                "method": event.method,
                "phase": phase.toJSON(),
                "meta": event.meta.toJSON(),
            }

            let event_data = new Map();
            event.data.forEach((data, index) => {
                event_data[types[index].type] = data.toString();
            });

            block_event["data"] = event_data;
            block_events.push(block_event);
        });

        const signedBlock = await polkadotConnector.rpc.chain.getBlock(blockHash);

        if (!signedBlock) {
            throw new Error('cannot get block');
        }

        let extrinsics = []

        signedBlock.block.extrinsics.forEach((ex, index) => {
            extrinsics.push(ex.toString());
        });

        let blockData = {
            'block': {
                'header': {
                    'number': signedBlock.block.header.number.toNumber(),
                    'hash': signedBlock.block.header.hash.toHex(),
                    'stateRoot': signedBlock.block.header.stateRoot.toHex(),
                    'extrinsicsRoot': signedBlock.block.header.extrinsicsRoot.toHex(),
                    'parentHash': signedBlock.block.header.parentHash.toHex(),
                    'digest': signedBlock.block.header.digest.toString()
                }
            },
            'extrinsics': [...extrinsics],
            'events': block_events
        }
        this.app.log.info(`Process block "${blockData.block.header.number}" with hash ${blockData.block.header.hash}`);

        const {kafkaConnector} = this.app;

        await kafkaConnector.send({
            topic: 'block_data',
            messages: [
                {
                    'value': JSON.stringify(blockData)
                },
            ],
        }).catch((error) => {
            this.app.log.error(`failed to push block: `, error);
            throw new Error('cannot push block to Kafka');
        });
    }

    /**
     * Update specs version metadata
     *
     * @private
     * @async
     * @param {BlockHash} blockHash - The block hash
     */
    async updateMetaData(blockHash) {

        const {polkadotConnector} = this.app;

        /** @type {RuntimeVersion} */
        const runtimeVersion = await polkadotConnector.rpc.state.getRuntimeVersion(blockHash);


        /** @type {u32} */
        const newSpecVersion = runtimeVersion.specVersion;

        if (newSpecVersion.gt(this.currentSpecVersion)) {
            this.app.log.info(`bumped spec version to ${newSpecVersion}, fetching new metadata`);

            const rpcMeta = await polkadotConnector.rpc.state.getMetadata(blockHash);

            currentSpecVersion = newSpecVersion;

            polkadotConnector.registry.setMetadata(rpcMeta);
        }
    }

    /**
     * Process all blocks with head
     *
     * @public
     * @async
     * @param startBlockNumber
     * @returns {Promise<void>}
     */
    async processBlocks(startBlockNumber = null) {

        await SyncStatus.acquire();

        try {

            this.app.log.info(`Starting processBlocks`);

            if (startBlockNumber == null) {
                startBlockNumber = await this.getLastProcessedBlock();
            }

            let lastBlockNumber = await this.getFinBlockNumber()

            this.app.log.info(`Processing blocks from ${startBlockNumber} to head: ${lastBlockNumber}`);

            for (let i = startBlockNumber + 1; i <= lastBlockNumber; i++) {
                for (let attempts = 5; attempts > 0; attempts--) {
                    let lastError = null
                    await this.processBlock(i).catch((error) => {
                        lastError = error
                        this.app.log.error(`failed to process block #${i}:`, error)
                    });

                    if (!lastError) {
                        break
                    }

                    await this.sleep(2000)
                }

                if (i == lastBlockNumber) {
                    lastBlockNumber = await this.getFinBlockNumber()
                }
            }

        } finally {
            // Please read and understand the WARNING above before using this API.
            SyncStatus.release();
        }
    }

    /**
     * Returns last processed block number from database
     *
     * @public
     * @async
     * @returns {Promise<number>}
     */
    async getLastProcessedBlock() {

        const {postgresConnector} = this.app

        let blockNumberFromDB = 0;

        await postgresConnector
            .query('SELECT max("NUMBER") as last_number FROM block')
            .then(res => {
                blockNumberFromDB = res.rows[0].last_number;
            })
            .catch(err => {
                this.app.log.error(`failed to get last synchronized block number`);
                throw new Error('cannot get last block number');
            });

        return blockNumberFromDB
    }

    async getFinBlockNumber() {
        const {polkadotConnector} = this.app;

        let lastFinHeader = await polkadotConnector.rpc.chain.getFinalizedHead()
        let lastFinBlock = await polkadotConnector.rpc.chain.getBlock(lastFinHeader)

        return lastFinBlock.block.header.number.toNumber()
    }

    /**
     * Synchronization status
     *
     * @typedef {Object} SyncSimpleStatus
     * @property {string} status
     * @property {number} fin_height_diff
     * @property {number} height_diff
     */

    /**
     *  Returns synchronization status, and diff between head and finalized head
     *
     * @public
     * @async
     * @returns {Promise<SyncSimpleStatus>}
     */
    async getBlocksStatus() {
        const {polkadotConnector} = this.app;

        let result = {
            status: 'undefined',
            height_diff: -1,
            fin_height_diff: -1
        }

        if (SyncStatus.isLocked()) {
            result.status = 'synchronization'
        } else {
            result.status = 'synchronized'
        }

        try {
            const lastBlockNumber = await this.getFinBlockNumber()
            const lastHeader = await polkadotConnector.rpc.chain.getHeader()
            const lastLocalNumber = await this.getLastProcessedBlock()


            result.height_diff = lastBlockNumber - lastLocalNumber
            result.fin_height_diff = lastHeader.number.toNumber() - lastBlockNumber

        } catch (err) {
            this.app.log.error(`failed to get block diff: ${err}`);
        }

        return result;
    }

    /**
     * Remove blocks data from database by numbers
     *
     * @public
     * @async
     * @param {number[]} blockNumbers
     * @returns {Promise<{result: boolean}>}
     */
    async removeBlocks(blockNumbers) {

        const {postgresConnector} = this.app

        postgresConnector.connect((err, client, release) => {
            if (err) {
                this.app.log.error(`failed to remove block from table: ${err}`);
                throw new Error('cannot remove blocks');
            }

            client.query({
                text: 'DELETE FROM block WHERE "NUMBER" = ANY($1::int[])',
                values: [blockNumbers]
            }, (err, result) => {
                release()
                if (err) {
                    this.app.log.error(`failed to remove block from table: ${err}`);
                    throw new Error('cannot remove blocks');
                }
            })
        })

        for (let tbl of ['balances', 'event', 'extrinsic']) {
            postgresConnector.connect((err, client, release) => {
                if (err) {
                    this.app.log.error(`failed to remove block from table "${tbl}": ${err}`);
                    throw new Error('cannot remove blocks');
                }

                client.query({
                    text: `DELETE FROM ${tbl} WHERE "BLOCK_NUMBER" = ANY($1::int[])`,
                    values: [blockNumbers]
                }, (err, result) => {
                    release()
                    if (err) {
                        this.app.log.error(`failed to remove block from table "${tbl}": ${err}`);
                        throw new Error('cannot remove blocks');
                    }
                })
            })
        }
        return {result: true}
    }

    /**
     * Remove blocks data from database from start
     *
     * @async
     * @private
     * @param {number} startBlockNumber
     * @returns {Promise<void>}
     */
    async trimBlocks(startBlockNumber) {

        const {postgresConnector} = this.app

        postgresConnector.connect((err, client, release) => {
            if (err) {
                this.app.log.error(`failed to remove block from table: ${err}`);
                throw new Error('cannot remove blocks');
            }

            client.query({
                text: 'DELETE FROM block WHERE "NUMBER" >= $1::int',
                values: [startBlockNumber]
            }, (err, result) => {
                release()
                if (err) {
                    this.app.log.error(`failed to remove blocks from table: ${err}`);
                    throw new Error('cannot remove blocks');
                }
            })
        })

        for (let tbl of ['balances', 'event', 'extrinsic']) {
            postgresConnector.connect((err, client, release) => {
                if (err) {
                    this.app.log.error(`failed to remove blocks from table "${tbl}": ${err}`);
                    throw new Error('cannot remove blocks');
                }

                client.query({
                    text: `DELETE FROM ${tbl} WHERE "BLOCK_NUMBER" >= $1::int`,
                    values: [startBlockNumber]
                }, (err, result) => {
                    release()
                    if (err) {
                        this.app.log.error(`failed to remove blocks from table "${tbl}": ${err}`);
                        throw new Error('cannot remove blocks');
                    }
                })
            })
        }
        return
    }


    /**
     * Trim last blocks and update up to finalized head
     *
     * @param {number} startBlockNumber
     * @returns {Promise<{result: boolean}>}
     */
    async trimAndUpdateToFinalized(startBlockNumber) {
        if (SyncStatus.isLocked()) {
            this.app.log.error(`failed setup "trimAndUpdateToFinalized": sync in process`);
            return {result: false}
        }

        try {

            await this.trimBlocks(startBlockNumber)
            await this.processBlocks(startBlockNumber)

        } catch (err) {
            this.app.log.error(`failed to execute trimAndUpdateToFinalized: ${err}`);
        }
        return {result: true}
    }

    /**
     *
     * @param {number} ms
     * @returns {Promise<>}
     */
    async sleep(ms) {
        return new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    }

}

/**
 *
 * @type {{BlocksService: BlocksService}}
 */
module.exports = {
    BlocksService: BlocksService
};
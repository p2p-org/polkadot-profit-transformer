import { SyncStatus } from '../index';
import { StakingService } from '../staking/staking';
import { ExtrinsicsService } from '../extrinsics/extrinsics';
import { environment } from '../../environment';
import { FastifyInstance } from 'fastify';
import { u32, Vec } from '@polkadot/types';
import { EventRecord } from '@polkadot/types/interfaces';
import { AnyJson, Codec } from '@polkadot/types/types';

const {KAFKA_PREFIX, DB_SCHEMA} = environment;

/**
 * Provides block operations
 * @class
 */
class BlocksService {
  private readonly app: FastifyInstance;
  private readonly currentSpecVersion: u32;
  private readonly stakingService: StakingService;
  private readonly extrinsicsService: ExtrinsicsService;

  /**
   * Creates an instance of BlocksService.
   * @param {object} app fastify app
   */
  constructor(app: FastifyInstance) {
    if (!app.ready) throw new Error(`can't get .ready from fastify app.`);

    /** @private */
    this.app = app;

    const {polkadotConnector} = this.app;

    if (!polkadotConnector) {
      throw new Error('cant get .polkadotConnector from fastify app.');
    }

    /** @type {u32} */
    this.currentSpecVersion = polkadotConnector.createType('u32', 0);

    const {kafkaProducer} = this.app;

    if (!kafkaProducer) {
      throw new Error('cant get .kafkaProducer from fastify app.');
    }

    const {postgresConnector} = this.app;

    if (!postgresConnector) {
      throw new Error('cant get .postgresConnector from fastify app.');
    }

    postgresConnector.connect((err, client, release) => {
      if (err) {
        this.app.log.error(`Error acquiring client: ${err.toString()}`);
        throw new Error(`Error acquiring client`);
      }
      client.query('SELECT NOW()', (err) => {
        release();
        if (err) {
          this.app.log.error(`Error executing query: ${err.toString()}`);
          throw new Error(`Error executing query`);
        }
      });
    });

    /** @private */
    this.stakingService = new StakingService(app);

    /** @private */
    this.extrinsicsService = new ExtrinsicsService(app);
  }

  /**
   * Update one block
   *
   * @public
   * @async
   * @param {number} blockNumber
   * @returns {Promise<boolean>}
   */
  async updateOneBlock(blockNumber: number): Promise<true> {
    if (SyncStatus.isLocked()) {
      this.app.log.error(`failed execute "updateOneBlock": sync in process`);
      throw new Error('sync in process');
    }

    await this.processBlock(blockNumber).catch((error) => {
      this.app.log.error(`failed to process block #${blockNumber}: ${error}`);
      throw new Error('cannot process block');
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
  async processBlock(height: number): Promise<void> {
    const {polkadotConnector} = this.app;
    const {kafkaProducer} = this.app;
    let blockHash = null;

    if (height == null) {
      throw new Error('empty height and blockHash');
    }

    blockHash = await polkadotConnector.rpc.chain.getBlockHash(height);

    if (!blockHash) {
      throw new Error('cannot get block hash');
    }

    // Check is this required
    // await this.updateMetaData(blockHash)

    const [sessionId, blockEra, signedBlock, extHeader, blockTime, events] = await Promise.all([
      polkadotConnector.query.session.currentIndex.at(blockHash),
      polkadotConnector.query.staking.currentEra.at(blockHash),
      polkadotConnector.rpc.chain.getBlock(blockHash),
      polkadotConnector.derive.chain.getHeader(blockHash),
      polkadotConnector.query.timestamp.now.at(blockHash),
      polkadotConnector.query.system.events.at(blockHash)
    ]);

    if (!signedBlock) {
      throw new Error('cannot get block');
    }
    let blockEvents = [];

    const processedEvents = await this.processEvents(signedBlock.block.header.number.toNumber(), events);
    blockEvents = processedEvents.events;

    const lastDigestLogEntry = signedBlock.block.header.digest.logs.length - 1;

    const blockData = {
      block: {
        header: {
          number: signedBlock.block.header.number.toNumber(),
          hash: signedBlock.block.header.hash.toHex(),
          author: extHeader?.author ? extHeader.author.toString() : '',
          session_id: sessionId.toNumber(),
          era: parseInt(blockEra.toString(), 10),
          stateRoot: signedBlock.block.header.stateRoot.toHex(),
          extrinsicsRoot: signedBlock.block.header.extrinsicsRoot.toHex(),
          parentHash: signedBlock.block.header.parentHash.toHex(),
          last_log: lastDigestLogEntry > -1 ? signedBlock.block.header.digest.logs[lastDigestLogEntry].type : '',
          digest: signedBlock.block.header.digest.toString()
        }
      },
      events: blockEvents,
      block_time: blockTime.toNumber()
    };

    this.app.log.info(`Process block "${blockData.block.header.number}" with hash ${blockData.block.header.hash}`);

    await kafkaProducer
        .send({
          topic: KAFKA_PREFIX + '_BLOCK_DATA',
          messages: [
            {
              key: blockData.block.header.number.toString(),
              value: JSON.stringify(blockData)
            }
          ]
        })
        .catch((error) => {
          this.app.log.error(`failed to push block: `, error);
          throw new Error('cannot push block to Kafka');
        });

    await this.extrinsicsService.extractExtrinsics(
        parseInt(blockEra.toString(), 10),
        sessionId.toNumber(),
        signedBlock.block.header.number,
        events,
        signedBlock.block.extrinsics
    );

    if (processedEvents.isNewSession) {
      await this.stakingService.extractStakers(parseInt(blockEra.toString(), 10), blockHash);
    }
  }

  /**
   * Update specs version metadata
   *
   * @private
   * @async
   * @param {BlockHash} blockHash - The block hash
   */
  private async updateMetaData(blockHash: any): Promise<void> {
    const {polkadotConnector} = this.app;

    /** @type {RuntimeVersion} */
    const runtimeVersion = await polkadotConnector.rpc.state.getRuntimeVersion(blockHash);

    /** @type {u32} */
    const newSpecVersion = runtimeVersion.specVersion;

    if (newSpecVersion.gt(this.currentSpecVersion)) {
      this.app.log.info(`bumped spec version to ${newSpecVersion}, fetching new metadata`);

      const rpcMeta = await polkadotConnector.rpc.state.getMetadata(blockHash);

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
  async processBlocks(startBlockNumber: number | null = null) {
    await SyncStatus.acquire();

    try {
      this.app.log.info(`Starting processBlocks`);

      if (!startBlockNumber) {
        startBlockNumber = await this.getLastProcessedBlock();
      }

      let lastBlockNumber = await this.getFinBlockNumber();

      this.app.log.info(`Processing blocks from ${startBlockNumber} to head: ${lastBlockNumber}`);

      for (let i = startBlockNumber; i <= lastBlockNumber; i += 10) {
        await Promise.all([
          this.runBlocksWorker(1, i),
          this.runBlocksWorker(2, i + 1),
          this.runBlocksWorker(3, i + 2),
          this.runBlocksWorker(4, i + 3),
          this.runBlocksWorker(5, i + 4),
          this.runBlocksWorker(6, i + 5),
          this.runBlocksWorker(7, i + 6),
          this.runBlocksWorker(8, i + 7),
          this.runBlocksWorker(9, i + 8),
          this.runBlocksWorker(10, i + 9)
        ]);

        if (i === lastBlockNumber) {
          lastBlockNumber = await this.getFinBlockNumber();
        }
      }
    } finally {
      // Please read and understand the WARNING above before using this API.
      SyncStatus.release();
    }
  }

  /**
   *
   * @private
   * @async
   * @param workerId
   * @param blockNumber
   * @returns {Promise<boolean>}
   */
  private async runBlocksWorker(workerId: number, blockNumber: number) {
    for (let attempts = 5; attempts > 0; attempts--) {
      let lastError = null;
      await this.processBlock(blockNumber).catch((error) => {
        lastError = error;
        this.app.log.error(`Worker id: "${workerId}" Failed to process block #${blockNumber}: ${error}`);
      });

      if (!lastError) {
        return true;
      }

      await this.sleep(2000);
    }
    return false;
  }

  /**
   * Returns last processed block number from database
   *
   * @public
   * @async
   * @returns {Promise<number>}
   */
  async getLastProcessedBlock(): Promise<number> {
    const {postgresConnector} = this.app;

    let blockNumberFromDB = 0;

    try {
      const {rows} = await postgresConnector.query(`SELECT id AS last_number FROM ${DB_SCHEMA}.blocks ORDER BY id DESC LIMIT 1`);

      if (rows.length && rows[0].last_number) {
        blockNumberFromDB = parseInt(rows[0].last_number);
      }
    } catch (err) {
      this.app.log.error(`failed to get last synchronized block number: ${err}`);
      throw new Error('cannot get last block number');
    }

    return blockNumberFromDB;
  }

  private async getFinBlockNumber() {
    const {polkadotConnector} = this.app;

    const lastFinHeader = await polkadotConnector.rpc.chain.getFinalizedHead();
    const lastFinBlock = await polkadotConnector.rpc.chain.getBlock(lastFinHeader);

    return lastFinBlock.block.header.number.toNumber();
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

    const result = {
      status: 'undefined',
      height_diff: -1,
      fin_height_diff: -1
    };

    if (SyncStatus.isLocked()) {
      result.status = 'synchronization';
    } else {
      result.status = 'synchronized';
    }

    try {
      const lastBlockNumber = await this.getFinBlockNumber();
      const lastHeader = await polkadotConnector.rpc.chain.getHeader();
      const lastLocalNumber = await this.getLastProcessedBlock();

      result.height_diff = lastBlockNumber - lastLocalNumber;
      result.fin_height_diff = lastHeader.number.toNumber() - lastBlockNumber;
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
  async removeBlocks(blockNumbers: number[]): Promise<{ result: true }> {
    const {postgresConnector} = this.app;

    postgresConnector.connect((err, client, release) => {
      if (err) {
        this.app.log.error(`failed to remove block from table: ${err}`);
        throw new Error('cannot remove blocks');
      }

      client.query(
          {
            text: `DELETE FROM "${DB_SCHEMA}.blocks" WHERE "id" = ANY($1::int[])`,
            values: [blockNumbers]
          },
          (err) => {
            release();
            if (err) {
              this.app.log.error(`failed to remove block from table: ${err}`);
              throw new Error('cannot remove blocks');
            }
          }
      );
    });

    for (const tbl of ['balances', 'events', 'extrinsics']) {
      postgresConnector.connect((err, client, release) => {
        if (err) {
          this.app.log.error(`failed to remove block from table "${DB_SCHEMA}.${tbl}": ${err}`);
          throw new Error('cannot remove blocks');
        }

        client.query(
            {
              text: `DELETE FROM "${DB_SCHEMA}.${tbl}" WHERE "block_id" = ANY($1::int[])`,
              values: [blockNumbers]
            },
            (err) => {
              release();
              if (err) {
                this.app.log.error(`failed to remove block from table "${DB_SCHEMA}.${tbl}": ${err}`);
                throw new Error('cannot remove blocks');
              }
            }
        );
      });
    }
    return {result: true};
  }

  /**
   * Remove blocks data from database from start
   *
   * @async
   * @private
   * @param {number} startBlockNumber
   * @returns {Promise<void>}
   */
  private async trimBlocks(startBlockNumber: number): Promise<void> {
    const {postgresConnector} = this.app;

    postgresConnector.connect((err, client, release) => {
      if (err) {
        this.app.log.error(`failed to remove block from table: ${err}`);
        throw new Error('cannot remove blocks');
      }

      client.query(
          {
            text: `DELETE FROM "${DB_SCHEMA}.blocks" WHERE "id" >= $1::int`,
            values: [startBlockNumber]
          },
          (err) => {
            release();
            if (err) {
              this.app.log.error(`failed to remove blocks from table: ${err}`);
              throw new Error('cannot remove blocks');
            }
          }
      );
    });

    for (const tbl of ['balances', 'events', 'extrinsics']) {
      postgresConnector.connect((err, client, release) => {
        if (err) {
          this.app.log.error(`failed to remove blocks from table "${tbl}": ${err}`);
          throw new Error('cannot remove blocks');
        }

        client.query(
            {
              text: `DELETE FROM "${DB_SCHEMA}.${tbl}" WHERE "id" >= $1::int`,
              values: [startBlockNumber]
            },
            (err) => {
              release();
              if (err) {
                this.app.log.error(`failed to remove blocks from table "${tbl}": ${err}`);
                throw new Error('cannot remove blocks');
              }
            }
        );
      });
    }
  }

  /**
   * Trim last blocks and update up to finalized head
   *
   * @param {number} startBlockNumber
   * @returns {Promise<{result: boolean}>}
   */
  async trimAndUpdateToFinalized(startBlockNumber: number): Promise<{ result: boolean }> {
    if (SyncStatus.isLocked()) {
      this.app.log.error(`failed setup "trimAndUpdateToFinalized": sync in process`);
      return {result: false};
    }

    try {
      await this.trimBlocks(startBlockNumber);
      await this.processBlocks(startBlockNumber);
    } catch (err) {
      this.app.log.error(`failed to execute trimAndUpdateToFinalized: ${err}`);
    }
    return {result: true};
  }

  /**
   *
   * @param {number} blockNumber
   * @param {Vec<EventRecord>} events
   * @returns {Promise<Object>}
   */
  private async processEvents(blockNumber: number, events: Vec<EventRecord>) {
    const blockEvents: {
      id: string;
      section: string;
      method: string;
      phase: AnyJson;
      meta: Record<string, AnyJson>;
      data: any[];
      event: Record<string, AnyJson>;
    }[] = [];

    let isNewSession = false;

    events.forEach((record, eventIndex) => {
      const {event, phase} = record;
      const types = event.typeDef;

      const eventData: { [x: string]: Codec; }[] = []

      if (event.section === 'session') {
        if (event.method === 'NewSession') {
          isNewSession = true
        }
      }

      if (event.data.length) {
        event.data.forEach((data, index) => {
          eventData.push({
            [types[index].type]: data
          })
        })

        blockEvents.push({
          id: `${blockNumber}-${eventIndex}`,
          section: event.section,
          method: event.method,
          phase: phase.toJSON(),
          meta: event.meta.toJSON(),
          data: eventData,
          event: event.toJSON()
        })
      }
    })
    return {
      events: blockEvents,
      isNewSession: isNewSession
    }
  }

  /**
   *
   * @param {number} ms
   * @returns {Promise<>}
   */
  async sleep(ms: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }
}

/**
 *
 * @type {{BlocksService: BlocksService}}
 */
export {
  BlocksService
}

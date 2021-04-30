import { SyncStatus } from '../index'
import StakingService from '../staking/staking'
import { ExtrinsicsService } from '../extrinsics/extrinsics'
import { environment } from '../../environment'
import { u32, Vec } from '@polkadot/types'
import { EventRecord } from '@polkadot/types/interfaces'
import { AnyJson, Codec } from '@polkadot/types/types'
import { IBlocksStatusResult } from './blocks.types'
import { counter } from '../statcollector/statcollector'
import { Pool } from 'pg'
import { Producer } from 'kafkajs'
import { ApiPromise } from '@polkadot/api'
import { Logger } from 'pino'
import { PostgresModule } from '../../modules/postgres.module'
import { PolkadotModule } from '../../modules/polkadot.module'
import { KafkaModule } from '../../modules/kafka.module'
import { LoggerModule } from '../../modules/logger.module'

const { KAFKA_PREFIX, DB_SCHEMA } = environment

/**
 * Provides block operations
 * @class
 */
class BlocksService {
  private readonly repository: Pool = PostgresModule.inject()
  private readonly kafkaProducer: Producer = KafkaModule.inject()
  private readonly polkadotApi: ApiPromise = PolkadotModule.inject()
  private readonly logger: Logger = LoggerModule.inject()
  private readonly currentSpecVersion: u32
  private readonly extrinsicsService: ExtrinsicsService
  private readonly stakingService: StakingService

  constructor() {
    this.currentSpecVersion = this.polkadotApi.createType('u32', 0)
    this.extrinsicsService = new ExtrinsicsService()
    this.stakingService = StakingService.getInstance()
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
      this.logger.error(`failed execute "updateOneBlock": sync in process`)
      throw new Error('sync in process')
    }

    await this.processBlock(blockNumber).catch((error) => {
      this.logger.error(`failed to process block #${blockNumber}: ${error}`)
      throw new Error('cannot process block')
    })
    return true
  }

  async processBlock(height: number): Promise<void> {
    let blockHash = null

    if (height == null) {
      throw new Error('empty height and blockHash')
    }

    blockHash = await this.polkadotApi.rpc.chain.getBlockHash(height)

    if (!blockHash) {
      throw new Error('cannot get block hash')
    }

    // Check if this required? Will try stage run without it
    // await this.updateMetaData(blockHash)

    const [sessionId, blockEra, signedBlock, extHeader, blockTime, events] = await Promise.all([
      this.polkadotApi.query.session.currentIndex.at(blockHash),
      this.polkadotApi.query.staking.currentEra.at(blockHash),
      this.polkadotApi.rpc.chain.getBlock(blockHash),
      this.polkadotApi.derive.chain.getHeader(blockHash),
      this.polkadotApi.query.timestamp.now.at(blockHash),
      this.polkadotApi.query.system.events.at(blockHash)
    ])

    const era = parseInt(blockEra.toString(), 10)

    if (!signedBlock) {
      throw new Error('cannot get block')
    }

    const processedEvents = await this.processEvents(signedBlock.block.header.number.toNumber(), events)

    const lastDigestLogEntry = signedBlock.block.header.digest.logs.length - 1

    const blockData = {
      block: {
        header: {
          number: signedBlock.block.header.number.toNumber(),
          hash: signedBlock.block.header.hash.toHex(),
          author: extHeader?.author ? extHeader.author.toString() : '',
          session_id: sessionId.toNumber(),
          era,
          stateRoot: signedBlock.block.header.stateRoot.toHex(),
          extrinsicsRoot: signedBlock.block.header.extrinsicsRoot.toHex(),
          parentHash: signedBlock.block.header.parentHash.toHex(),
          last_log: lastDigestLogEntry > -1 ? signedBlock.block.header.digest.logs[lastDigestLogEntry].type : '',
          digest: signedBlock.block.header.digest.toString()
        }
      },
      events: processedEvents,
      block_time: blockTime.toNumber()
    }

    this.logger.info(`Process block "${blockData.block.header.number}" with hash ${blockData.block.header.hash}`)

    try {
      await this.kafkaProducer.send({
        topic: KAFKA_PREFIX + '_BLOCK_DATA',
        messages: [
          {
            key: blockData.block.header.number.toString(),
            value: JSON.stringify(blockData)
          }
        ]
      })
    } catch (error) {
      this.logger.error(`failed to push block: `, error)
      throw new Error('cannot push block to Kafka')
    }

    await this.extrinsicsService.extractExtrinsics(
      era,
      sessionId.toNumber(),
      signedBlock.block.header.number,
      events,
      signedBlock.block.extrinsics
    )

    const findEraPayoutEvent = (events: Vec<EventRecord>) => {
      return events.find((event) => event.event.section === 'staking' && event.event.method === 'EraPayout')
    }

    const eraPayoutEvent = findEraPayoutEvent(events)

    if (eraPayoutEvent) {
      this.stakingService.addToQueue({ eraPayoutEvent, blockHash })
    }

    counter.inc(1)
  }

  /**
   * Update specs version metadata
   *
   * @private
   * @async
   * @param {BlockHash} blockHash - The block hash
   */
  private async updateMetaData(blockHash: any): Promise<void> {
    /** @type {RuntimeVersion} */
    const runtimeVersion = await this.polkadotApi.rpc.state.getRuntimeVersion(blockHash)

    /** @type {u32} */
    const newSpecVersion = runtimeVersion.specVersion

    if (newSpecVersion.gt(this.currentSpecVersion)) {
      this.logger.info(`bumped spec version to ${newSpecVersion}, fetching new metadata`)

      const rpcMeta = await this.polkadotApi.rpc.state.getMetadata(blockHash)

      this.polkadotApi.registry.setMetadata(rpcMeta)
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
  async processBlocks(startBlockNumber: number | null = null): Promise<void> {
    await SyncStatus.acquire()

    try {
      this.logger.info(`Starting processBlocks`)

      if (!startBlockNumber) {
        startBlockNumber = await this.getLastProcessedBlock()
      }

      let lastBlockNumber = await this.getFinBlockNumber()

      this.logger.info(`Processing blocks from ${startBlockNumber} to head: ${lastBlockNumber}`)

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
        ])

        if (i === lastBlockNumber) {
          lastBlockNumber = await this.getFinBlockNumber()
        }
      }
    } finally {
      // Please read and understand the WARNING above before using this API.
      SyncStatus.release()
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
      let lastError = null
      await this.processBlock(blockNumber).catch((error) => {
        lastError = error
        this.logger.error(`Worker id: "${workerId}" Failed to process block #${blockNumber}: ${error}`)
      })

      if (!lastError) {
        return true
      }

      await this.sleep(2000)
    }
    return false
  }

  /**
   * Returns last processed block number from database
   *
   * @public
   * @async
   * @returns {Promise<number>}
   */
  async getLastProcessedBlock(): Promise<number> {
    let blockNumberFromDB = 0

    try {
      const { rows } = await this.repository.query(`SELECT id AS last_number FROM ${DB_SCHEMA}.blocks ORDER BY id DESC LIMIT 1`)

      if (rows.length && rows[0].last_number) {
        blockNumberFromDB = parseInt(rows[0].last_number)
      }
    } catch (err) {
      this.logger.error(`failed to get last synchronized block number: ${err}`)
      throw new Error('cannot get last block number')
    }

    return blockNumberFromDB
  }

  async getFinBlockNumber(): Promise<number> {
    const lastFinHeader = await this.polkadotApi.rpc.chain.getFinalizedHead()
    const lastFinBlock = await this.polkadotApi.rpc.chain.getBlock(lastFinHeader)

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
  async getBlocksStatus(): Promise<IBlocksStatusResult> {
    const result = {
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
      const lastHeader = await this.polkadotApi.rpc.chain.getHeader()
      const lastLocalNumber = await this.getLastProcessedBlock()

      result.height_diff = lastBlockNumber - lastLocalNumber
      result.fin_height_diff = lastHeader.number.toNumber() - lastBlockNumber
    } catch (err) {
      this.logger.error(`failed to get block diff: ${err}`)
    }

    return result
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
    const transaction = await this.repository.connect()

    try {
      await transaction.query({
        text: `DELETE FROM "${DB_SCHEMA}.blocks" WHERE "id" = ANY($1::int[])`,
        values: [blockNumbers]
      })

      for (const tbl of ['balances', 'events', 'extrinsics']) {
        await transaction.query({
          text: `DELETE FROM "${DB_SCHEMA}.${tbl}" WHERE "block_id" = ANY($1::int[])`,
          values: [blockNumbers]
        })
      }

      await transaction.query('COMMIT')
      transaction.release()
    } catch (err) {
      this.logger.error(`failed to remove block from table: ${err}`)
      await transaction.query('ROLLBACK')
      transaction.release()
      throw new Error('cannot remove blocks')
    }

    return { result: true }
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
    const transaction = await this.repository.connect()

    try {
      await transaction.query({
        text: `DELETE FROM "${DB_SCHEMA}.blocks" WHERE "id" >= $1::int`,
        values: [startBlockNumber]
      })

      for (const tbl of ['balances', 'events', 'extrinsics']) {
        await transaction.query({
          text: `DELETE FROM "${DB_SCHEMA}.${tbl}" WHERE "id" >= $1::int`,
          values: [startBlockNumber]
        })
      }

      await transaction.query('COMMIT')
      transaction.release()
    } catch (err) {
      this.logger.error(`failed to remove blocks from table: ${err}`)
      await transaction.query('ROLLBACK')
      transaction.release()
      throw new Error('cannot remove blocks')
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
      this.logger.error(`failed setup "trimAndUpdateToFinalized": sync in process`)
      return { result: false }
    }

    try {
      await this.trimBlocks(startBlockNumber)
      await this.processBlocks(startBlockNumber)
    } catch (err) {
      this.logger.error(`failed to execute trimAndUpdateToFinalized: ${err}`)
    }
    return { result: true }
  }

  private async processEvents(blockNumber: number, events: Vec<EventRecord>) {
    interface IEvent {
      id: string
      section: string
      method: string
      phase: AnyJson
      meta: Record<string, AnyJson>
      data: any[]
      event: Record<string, AnyJson>
    }

    const processEvent = (acc: Array<IEvent>, record: EventRecord, eventIndex: number): Array<IEvent> => {
      const { event, phase } = record

      const types = event.typeDef

      const extractEventData = (eventDataRaw: any[]): { [x: string]: Codec }[] =>
        eventDataRaw.map((data: any, index: number) => ({ [types[index].type]: data }))

      acc.push({
        id: `${blockNumber}-${eventIndex}`,
        section: event.section,
        method: event.method,
        phase: phase.toJSON(),
        meta: event.meta.toJSON(),
        data: extractEventData(event.data),
        event: event.toJSON()
      })

      return acc
    }

    return events.reduce(processEvent, [])
  }

  /**
   *
   * @param {number} ms
   * @returns {Promise<>}
   */
  async sleep(ms: number): Promise<any> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }
}

/**
 *
 * @type {{BlocksService: BlocksService}}
 */
export { BlocksService }

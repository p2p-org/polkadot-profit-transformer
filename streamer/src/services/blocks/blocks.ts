import { SyncStatus } from '../index'
import StakingService from '../staking/staking'
import { ExtrinsicsService } from '../extrinsics/extrinsics'
import { environment } from '../../environment'
import { Vec } from '@polkadot/types'
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
import { IConsumerService } from '../consumer/consumer.types'

const { KAFKA_PREFIX, DB_SCHEMA } = environment

const { ConsumerService } = require('../consumer/consumer')

/**
 * Provides block operations
 * @class
 */
class BlocksService {
  private readonly repository: Pool = PostgresModule.inject()
  private readonly kafkaProducer: Producer = KafkaModule.inject()
  private readonly polkadotApi: ApiPromise = PolkadotModule.inject()
  private readonly logger: Logger = LoggerModule.inject()

  private readonly extrinsicsService: ExtrinsicsService
  private readonly stakingService: StakingService
  private readonly consumerService: IConsumerService = new ConsumerService()

  constructor() {
    this.extrinsicsService = new ExtrinsicsService()
    this.stakingService = StakingService.getInstance()
  }

  async updateOneBlock(blockNumber: number): Promise<true> {
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

    const [sessionId, blockCurrentEra, activeEra, signedBlock, extHeader, blockTime, events] = await Promise.all([
      this.polkadotApi.query.session.currentIndex.at(blockHash),
      this.polkadotApi.query.staking.currentEra.at(blockHash),
      this.polkadotApi.query.staking.activeEra.at(blockHash),
      this.polkadotApi.rpc.chain.getBlock(blockHash),
      this.polkadotApi.derive.chain.getHeader(blockHash),
      this.polkadotApi.query.timestamp.now.at(blockHash),
      this.polkadotApi.query.system.events.at(blockHash)
    ])

    const currentEra = parseInt(blockCurrentEra.toString(), 10)
    const era = Number(activeEra.unwrap().get('index'))

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
          currentEra,
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
      return events.find((event: { event: { section: string; method: string } }) => event.event.section === 'staking' && event.event.method === 'EraPayout')
    }

    const eraPayoutEvent = findEraPayoutEvent(events)

    if (eraPayoutEvent) {
      this.stakingService.addToQueue({ eraPayoutEvent, blockHash })
    }

    counter.inc(1)
  }

  /**
   * Check responses from storage, depended from HISTORY_DEPTH
   *
   * @public
   * @async
   * @param blockNumber
   * @returns {Promise<boolean>}
   */
  async checkHistoryDepthAvailableData(blockNumber: number): Promise<boolean> {

    const blockHash = await this.polkadotApi.rpc.chain.getBlockHash(blockNumber)

    if (!blockHash) {
      this.logger.error(`Cannot get block hash: ${blockNumber}`)
      return false
    }

    const historyDepth = await this.polkadotApi.query.staking.historyDepth.at(blockHash)

    const currentRawEra = await this.polkadotApi.query.staking.currentEra()
    const blockRawEra = await this.polkadotApi.query.staking.currentEra.at(blockHash)

    if (blockRawEra == null) {
      this.logger.error(`Cannot get currentEra by hash: ${blockHash}`)
      return false
    }

    const blockEra = parseInt(blockRawEra.toString(), 10)

    if (currentRawEra.unwrap().toNumber() - blockEra > historyDepth.toNumber()) {
      this.logger.info(`The block height less than HISTORY_DEPTH value: ${historyDepth.toNumber()}`)

      const [sessionId, activeEra, extHeader] = await Promise.all([
        this.polkadotApi.query.session.currentIndex.at(blockHash),
        this.polkadotApi.query.staking.activeEra.at(blockHash),
        this.polkadotApi.derive.chain.getHeader(blockHash)
      ])

      let hasError = false
      if (sessionId == null) {
        hasError = true
        this.logger.error(`Cannot get "sessionId" for block ${blockNumber} by hash: ${blockHash}`)
      }

      if (activeEra == null || activeEra.isNone) {
        hasError = true
        this.logger.error(`Cannot get "activeEra" for block ${blockNumber} by hash: ${blockHash}`)
      }

      if (extHeader == null || extHeader.isEmpty) {
        hasError = true
        this.logger.error(`Cannot get "extHeader" for block ${blockNumber} by hash: ${blockHash}`)
      }

      if (hasError) {
        return false
      }
    }
    return true
  }

  /**
   * Process all blocks with head
   *
   * @public
   * @async
   * @param startBlockNumber
   * @param optionSubscribeFinHead
   * @returns {Promise<void>}
   */
  async processBlocks(startBlockNumber: number | null = null, optionSubscribeFinHead: boolean | null = null): Promise<void> {
    if (startBlockNumber === null) {
      startBlockNumber = await this.getLastProcessedBlock()
    }

    this.logger.info(`Starting processBlocks from ${startBlockNumber}`)

    let lastBlockNumber = await this.getFinBlockNumber()

    this.logger.info(`Processing blocks from ${startBlockNumber} to head: ${lastBlockNumber}`)

    let blockNumber: number = startBlockNumber

    if (!await this.checkHistoryDepthAvailableData(startBlockNumber)) {
      this.logger.error('Cannot receive storage data older than HISTORY_DEPTH')
      SyncStatus.release()
      return
    }

    while (blockNumber <= lastBlockNumber) {
      const chunk = lastBlockNumber - blockNumber >= 10 ? 10 : (lastBlockNumber - blockNumber) % 10
      const processTasks = Array(chunk)
        .fill('')
        .map((_, i) => this.runBlocksWorker(i + 1, blockNumber + i))

      await Promise.all(processTasks)

      blockNumber += 10

      if (blockNumber > lastBlockNumber) {
        lastBlockNumber = await this.getFinBlockNumber()
      }
    }

    SyncStatus.release()

    if (optionSubscribeFinHead) this.consumerService.subscribeFinalizedHeads()
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
}

/**
 *
 * @type {{BlocksService: BlocksService}}
 */
export { BlocksService }

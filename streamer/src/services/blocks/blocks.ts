import { SyncStatus } from '../index'
import StakingService from '../staking/staking'
import { ExtrinsicsService } from '../extrinsics/extrinsics'
import { environment } from '../../environment'
import { Vec } from '@polkadot/types'
import { EventRecord } from '@polkadot/types/interfaces'
import { AnyJson, Codec } from '@polkadot/types/types'
import { IBlocksStatusResult } from './blocks.types'
import { counter } from '../statcollector/statcollector'
import { Producer } from 'kafkajs'
import { ApiPromise } from '@polkadot/api'
import { Logger } from 'pino'
import { PolkadotModule } from '../../modules/polkadot.module'
import { KafkaModule } from '../../modules/kafka.module'
import { LoggerModule } from '../../modules/logger.module'
import { BlockRepository } from '../../repositores/block.repository'
import { BlockServiceError, EBlockServiceError } from '../../common/errors/blocks.error'

const { KAFKA_PREFIX } = environment

/**
 * Provides block operations
 * @class
 */
class BlocksService {
  private readonly blockRepository: BlockRepository = new BlockRepository()
  private readonly kafkaProducer: Producer = KafkaModule.inject()
  private readonly polkadotApi: ApiPromise = PolkadotModule.inject()
  private readonly logger: Logger = LoggerModule.inject()

  private readonly extrinsicsService: ExtrinsicsService
  private readonly stakingService: StakingService

  constructor() {
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
      throw new BlockServiceError(EBlockServiceError.SYNC_IN_PROCESS)
    }

    try {
      await this.processBlock(blockNumber)
    } catch (error) {
      this.logger.error(`failed to process block #${blockNumber}: ${error}`)
      throw new BlockServiceError(EBlockServiceError.BLOCK_PROCESS_ERROR)
    }

    return true
  }

  async processBlock(height: number): Promise<void> {
    const blockHash = await this.polkadotApi.rpc.chain.getBlockHash(height)

    if (!blockHash) {
      throw new BlockServiceError(EBlockServiceError.BLOCKHASH_NOT_FOUND)
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
      throw new BlockServiceError(EBlockServiceError.BLOCK_NOT_FOUND)
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
      throw new BlockServiceError(EBlockServiceError.KAFKA_SEND_ERROR)
    }

    await this.extrinsicsService.extractExtrinsics(
      era,
      sessionId.toNumber(),
      signedBlock.block.header.number,
      events,
      signedBlock.block.extrinsics
    )

    const eraPayoutEvent = this.findEraPayoutEvent(events)

    if (eraPayoutEvent) {
      this.stakingService.addToQueue({ eraPayoutEvent, blockHash })
    }

    counter.inc(1)
  }

  /**
   * Process all blocks with head
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
   * Returns last processed block number from database
   */
  async getLastProcessedBlock(): Promise<number> {
    return this.blockRepository.getLastProcessedBlock()
  }

  async getFinBlockNumber(): Promise<number> {
    const lastFinHeader = await this.polkadotApi.rpc.chain.getFinalizedHead()
    const lastFinBlock = await this.polkadotApi.rpc.chain.getBlock(lastFinHeader)

    return lastFinBlock.block.header.number.toNumber()
  }

  /**
   *  Returns synchronization status, and diff between head and finalized head
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
   */
  async removeBlocks(blockNumbers: number[]): Promise<{ result: true }> {
    try {
      await this.blockRepository.removeBlockData(blockNumbers)
    } catch (err) {
      throw new BlockServiceError(EBlockServiceError.REMOVE_BLOCK_ERROR)
    }

    return { result: true }
  }

  /**
   * Trim last blocks and update up to finalized head
   */
  async trimAndUpdateToFinalized(startBlockNumber: number): Promise<{ result: boolean }> {
    if (SyncStatus.isLocked()) {
      this.logger.error(`failed setup "trimAndUpdateToFinalized": sync in process`)
      return { result: false }
    }

    try {
      await this.blockRepository.trimBlocksFrom(startBlockNumber)
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
  private async sleep(ms: number): Promise<any> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  private findEraPayoutEvent (events: Vec<EventRecord>) {
    return events.find((event) => event.event.section === 'staking' && event.event.method === 'EraPayout')
  }

  private async runBlocksWorker(workerId: number, blockNumber: number) {
    for (let attempts = 5; attempts > 0; attempts--) {
      let lastError = null

      try {
        await this.processBlock(blockNumber)
      } catch (error) {
        lastError = error
        this.logger.error(`Worker id: "${workerId}" Failed to process block #${blockNumber}: ${error}`)
      }

      if (!lastError) {
        return true
      }

      await this.sleep(2000)
    }
    return false
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

export { BlocksService }

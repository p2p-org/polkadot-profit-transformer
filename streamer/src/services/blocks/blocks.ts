import { Vec } from '@polkadot/types'
import { EventRecord } from '@polkadot/types/interfaces'
import { Codec } from '@polkadot/types/types'
import { IBlockData, IBlocksService, IBlocksStatusResult, IEvent, SyncStatus } from './blocks.types'
import { counter } from '../statcollector/statcollector'
import { PolkadotModule } from '../../modules/polkadot.module'
import { KafkaModule } from '../../modules/kafka'
import { ILoggerModule, LoggerModule } from '../../modules/logger.module'
import { IExtrinsicsService, ExtrinsicsService } from '../extrinsics'
import { IConsumerService, ConsumerService } from '../consumer'
import { IStakingService, StakingService } from '../staking'
import { BlockRepository } from '../../repositories/block.repository'

class BlocksService implements IBlocksService {
  private static status: SyncStatus
  private static instance: BlocksService
  private readonly blockRepository: BlockRepository = BlockRepository.inject()
  private readonly kafka: KafkaModule = KafkaModule.inject()
  private readonly polkadotApi: PolkadotModule = PolkadotModule.inject()
  private readonly logger: ILoggerModule = LoggerModule.inject()
  private readonly extrinsicsService: IExtrinsicsService = new ExtrinsicsService()
  private readonly stakingService: IStakingService = StakingService.inject()
  private readonly consumerService: IConsumerService = new ConsumerService()

  constructor() {
    if (BlocksService.instance) {
      return BlocksService.instance
    }

    BlocksService.instance = this
  }

  static isSyncComplete(): boolean {
    return BlocksService.status === SyncStatus.SUBSCRIPTION
  }

  async processBlock(height: number): Promise<void> {
    let blockHash = null

    blockHash = await this.polkadotApi.getBlockHashByHeight(height)

    if (!blockHash) {
      throw new Error('cannot get block hash')
    }

    const [sessionId, blockCurrentEra, activeEra, signedBlock, extHeader, blockTime, events] = await this.polkadotApi.getInfoToProcessBlock(
      blockHash
    )

    const currentEra = parseInt(blockCurrentEra.toString(), 10)
    const era = activeEra.isNone ? currentEra : Number(activeEra.unwrap().get('index'))

    const processedEvents = await this.processEvents(signedBlock.block.header.number.toNumber(), events)

    const lastDigestLogEntry = signedBlock.block.header.digest.logs.length - 1

    const blockData: IBlockData = {
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

    await this.kafka.sendBlockData(blockData)

    await this.extrinsicsService.extractExtrinsics(
      era,
      sessionId.toNumber(),
      signedBlock.block.header.number,
      events,
      signedBlock.block.extrinsics
    )

    const findEraPayoutEvent = (events: Vec<EventRecord>) => {
      return events.find(
        (event: { event: { section: string; method: string } }) => event.event.section === 'staking' && event.event.method === 'EraPayout'
      )
    }

    const eraPayoutEvent = findEraPayoutEvent(events)

    if (eraPayoutEvent) {
      const [eraId] = eraPayoutEvent.event.data
      this.stakingService.addToQueue({ eraId: eraId?.toString(), blockHash })
    }

    counter.inc(1)
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
    BlocksService.status = SyncStatus.SYNC

    if (!startBlockNumber) {
      startBlockNumber = await this.blockRepository.getLastProcessedBlock()
    }

    this.logger.info(`Starting processBlocks from ${startBlockNumber}`)

    let lastBlockNumber = await this.polkadotApi.getFinBlockNumber()

    this.logger.info(`Processing blocks from ${startBlockNumber} to head: ${lastBlockNumber}`)

    let blockNumber: number = startBlockNumber

    while (blockNumber <= lastBlockNumber) {
      const chunk = lastBlockNumber - blockNumber >= 10 ? 10 : (lastBlockNumber - blockNumber) % 10
      const processTasks = Array(chunk)
        .fill('')
        .map((_, i) => this.runBlocksWorker(i + 1, blockNumber + i))

      await Promise.all(processTasks)

      blockNumber += 10

      if (blockNumber > lastBlockNumber) {
        lastBlockNumber = await this.polkadotApi.getFinBlockNumber()
      }
    }

    BlocksService.status = SyncStatus.SUBSCRIPTION

    if (optionSubscribeFinHead) this.consumerService.subscribeFinalizedHeads()
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

    if (!BlocksService.isSyncComplete()) {
      result.status = 'synchronization'
    } else {
      result.status = 'synchronized'
    }

    try {
      const lastBlockNumber = await this.polkadotApi.getFinBlockNumber()
      const lastHeader = await this.polkadotApi.getHeader()
      const lastLocalNumber = await this.blockRepository.getLastProcessedBlock()

      result.height_diff = lastBlockNumber - lastLocalNumber
      result.fin_height_diff = lastHeader.number.toNumber() - lastBlockNumber
    } catch (err) {
      this.logger.error(`failed to get block diff: ${err}`)
    }

    return result
  }

  async removeBlocks(blockNumbers: number[]): Promise<{ result: true }> {
    await this.blockRepository.removeBlockData(blockNumbers)

    return { result: true }
  }

  async trimAndUpdateToFinalized(startBlockNumber: number): Promise<{ result: boolean }> {
    if (BlocksService.isSyncComplete()) {
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

  async sleep(ms: number): Promise<any> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  async runBlocksWorker(workerId: number, blockNumber: number): Promise<boolean> {
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

  private async processEvents(blockNumber: number, events: Vec<EventRecord>) {
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

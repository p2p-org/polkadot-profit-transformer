import { Vec } from '@polkadot/types'
import { EventRecord } from '@polkadot/types/interfaces'
import { Codec } from '@polkadot/types/types'
import { IBlockData, IBlocksService, IBlocksStatusResult, IEvent, SyncStatus } from './blocks.types'
import { counter } from '../statcollector/statcollector'
import { PolkadotModule } from '@modules/polkadot.module'
import { KafkaModule } from '@modules/kafka'
import { ILoggerModule, LoggerModule } from '@modules/logger.module'
import { IExtrinsicsService, ExtrinsicsService } from '../extrinsics'
import { IConsumerService, ConsumerService } from '../consumer'
import { IStakingService, StakingService } from '../staking'
import { BlockRepository } from '@repositories/block.repository'

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

  static inject(): BlocksService {
    if (!BlocksService.instance) {
      BlocksService.instance = new BlocksService()
    }

    return BlocksService.instance
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

    this.logger.info(
      {
        block_id: height,
        hash: blockHash
      },
      'Block processing start'
    )

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

  async processBlocks(startBlockNumber: number | null = null, optionSubscribeFinHead: boolean | null = null): Promise<void> {
    BlocksService.status = SyncStatus.SYNC

    if (!startBlockNumber) {
      startBlockNumber = await this.blockRepository.getLastProcessedBlock()
    }

    this.logger.info({ block_id: startBlockNumber }, `Starting processBlocks from ${startBlockNumber}`)

    let lastBlockNumber = await this.polkadotApi.getFinBlockNumber()

    this.logger.info(`Processing blocks from ${startBlockNumber} to head: ${lastBlockNumber}`)

    let blockNumber: number = startBlockNumber

    counter.inc(blockNumber)

    while (blockNumber <= lastBlockNumber) {
      const chunk = 10
      const processTasks = Array(chunk)
        .fill('')
        .map((_, i) => this.runBlocksWorker(i + 1, blockNumber + i))

      await Promise.all(processTasks)

      blockNumber += 10

      lastBlockNumber = await this.polkadotApi.getFinBlockNumber()
    }

    BlocksService.status = SyncStatus.SUBSCRIPTION

    if (optionSubscribeFinHead) return this.consumerService.subscribeFinalizedHeads()
  }

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
      this.logger.error({ err }, `failed to get block diff`)
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
      this.logger.error({ err }, `failed to execute trimAndUpdateToFinalized`)
    }
    return { result: true }
  }

  async sleep(ms: number): Promise<any> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

  async runBlocksWorker(workerId: number, blockNumber: number): Promise<void> {
    for (let attempts = 0; attempts < 5; attempts++) {
      try {
        await this.processBlock(blockNumber)
        return
      } catch (error) {
        this.logger.error({ error }, `Worker id: "${workerId}" Failed attempt ${attempts} to process block #${blockNumber}`)
        if (error.message === 'Unable to retrieve header and parent from supplied hash') return
        await this.sleep(2000)
      }
    }
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

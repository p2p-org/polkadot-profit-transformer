import { SyncStatus } from '../index'
import { Vec } from '@polkadot/types'
import { EventRecord } from '@polkadot/types/interfaces'
import { Codec } from '@polkadot/types/types'
import { IBlockData, IBlocksService, IBlocksStatusResult, IEvent } from './blocks.types'
import { counter } from '../statcollector/statcollector'
import { ApiPromise } from '@polkadot/api'
import { Logger } from 'pino'
import { PolkadotModule } from '../../modules/polkadot.module'
import { KafkaModule } from '../../modules/kafka.module'
import { LoggerModule } from '../../modules/logger.module'
import { ExtrinsicsService } from '../extrinsics/extrinsics'
import { IConsumerService } from '../consumer/consumer.types'
import { IExtrinsicsService } from '../extrinsics/extrinsics.types'
import StakingService from '../staking/staking'
import { IStakingService } from '../staking/staking.types'
import { BlockRepository } from '../../repositores/block.repository'
import { ConsumerService } from '../consumer/consumer'

class BlocksService implements IBlocksService {
  private readonly blockRepository: BlockRepository
  private readonly kafka: KafkaModule
  private readonly polkadotApi: ApiPromise
  private readonly logger: Logger

  private readonly extrinsicsService: IExtrinsicsService
  private readonly stakingService: IStakingService
  private readonly consumerService: IConsumerService

  constructor(
    repository?: BlockRepository,
    polkadotApi?: ApiPromise,
    logger?: Logger,
    kafka?: KafkaModule,
    extrinsicsService?: IExtrinsicsService,
    stakingService?: IStakingService,
    consumerService?: IConsumerService
  ) {
    this.blockRepository = repository ?? BlockRepository.inject()
    this.polkadotApi = polkadotApi ?? PolkadotModule.inject()
    this.logger = logger ?? LoggerModule.inject()
    this.kafka = kafka ?? KafkaModule.inject()
    this.extrinsicsService = extrinsicsService ?? new ExtrinsicsService()
    this.stakingService = stakingService ?? StakingService.inject()
    this.consumerService = consumerService ?? new ConsumerService()
  }

  async processBlock(height: number): Promise<void> {
    const processEvents = async (blockNumber: number, events: Vec<EventRecord>) => {
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

    const blockHash = await this.polkadotApi.rpc.chain.getBlockHash(height)

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

    const processedEvents = await processEvents(signedBlock.block.header.number.toNumber(), events)

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
      // TODO add cases in tests where payout event is found or not found
      this.stakingService.addToQueue({ eraPayoutEvent, blockHash })
    }

    counter.inc(1)
  }

  async processBlocks(startBlockNumber: number | null = null, optionSubscribeFinHead: boolean | null = null): Promise<void> {
    const release = await SyncStatus.acquire()

    if (startBlockNumber === null) {
      startBlockNumber = await this.blockRepository.getLastProcessedBlock()
    }

    this.logger.info(`Starting processBlocks from ${startBlockNumber}`)

    let lastBlockNumber = await this.getFinBlockNumber()

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
        lastBlockNumber = await this.getFinBlockNumber()
      }
    }

    release()

    if (optionSubscribeFinHead) this.consumerService.subscribeFinalizedHeads()
  }

  async getFinBlockNumber(): Promise<number> {
    const lastFinHeader = await this.polkadotApi.rpc.chain.getFinalizedHead()
    const lastFinBlock = await this.polkadotApi.rpc.chain.getBlock(lastFinHeader)

    return lastFinBlock.block.header.number.toNumber()
  }

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
      const lastLocalNumber = await this.blockRepository.getLastProcessedBlock()

      result.height_diff = lastBlockNumber - lastLocalNumber
      result.fin_height_diff = lastHeader.number.toNumber() - lastBlockNumber
      return result
    } catch (err) {
      this.logger.error(`failed to get block diff: ${err}`)
      throw err
    }
  }

  async removeBlocks(blockNumbers: number[]): Promise<{ result: true }> {
    await this.blockRepository.removeBlockData(blockNumbers)

    return { result: true }
  }

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

  async sleep(ms: number): Promise<any> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }

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
}

export { BlocksService }

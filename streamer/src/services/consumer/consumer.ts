import { IConsumerService } from './consumer.types'
import { IBlocksService, BlocksService } from '../blocks'
import { Header } from '@polkadot/types/interfaces'
import { PolkadotModule } from '@modules/polkadot.module'
import { ILoggerModule, LoggerModule } from '@modules/logger.module'
import { BlockRepository } from '@repositories/block.repository'

class ConsumerService implements IConsumerService {
  private static instance: ConsumerService

  private readonly blockRepository: BlockRepository = BlockRepository.inject()
  private readonly polkadotApi: PolkadotModule = PolkadotModule.inject()
  private readonly logger: ILoggerModule = LoggerModule.inject()

  constructor() {
    if (ConsumerService.instance) {
      return ConsumerService.instance
    }

    ConsumerService.instance = this
  }
  /**
   * Subscribe to finalized heads stream
   *
   * @async
   * @returns {Promise<void>}
   */
  async subscribeFinalizedHeads(): Promise<void> {
    if (!BlocksService.isSyncComplete()) {
      this.logger.error(`failed setup "subscribeFinalizedHeads": sync in process`)
      return
    }

    this.logger.info(`Starting subscribeFinalizedHeads`)

    const blockNumberFromDB = await this.blockRepository.getLastProcessedBlock()

    if (blockNumberFromDB === 0) {
      this.logger.warn(`"subscribeFinalizedHeads" capture enabled but, not synchronized blocks `)
    }

    await this.polkadotApi.subscribeFinalizedHeads((header) => this.onFinalizedHead(header))
  }

  private async onFinalizedHead(blockHash: Header): Promise<void> {
    const blocksService: IBlocksService = new BlocksService()

    const blockNumberFromDB = await this.blockRepository.getLastProcessedBlock()
    const blockNumber = blockHash.number.toNumber()

    if (blockNumber === blockNumberFromDB) {
      return
    }

    this.logger.info({ blockHash }, `Captured new finalized block `)

    if (blockNumber < blockNumberFromDB) {
      this.logger.info(`stash operation detected`)
      await blocksService.trimAndUpdateToFinalized(blockHash.number.toNumber())
    }

    try {
      await blocksService.processBlock(blockNumber, false)
    } catch (error) {
      this.logger.error({ error }, `failed to process captured block #${blockHash}:`)
    }
  }
}

export { ConsumerService }

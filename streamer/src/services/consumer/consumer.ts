import {} from './../blocks/blocks.types'
import { IConsumerService } from './consumer.types'
import { IBlocksService } from '../blocks/blocks.types'
import { BlocksService } from '../blocks/blocks'
import { Header } from '@polkadot/types/interfaces'
import { PolkadotModule } from '../../modules/polkadot.module'
import { ILoggerModule, LoggerModule } from '../../modules/logger.module'
import { BlockRepository } from '../../repositories/block.repository'

class ConsumerService implements IConsumerService {
  private readonly blockRepository: BlockRepository = BlockRepository.inject()
  private readonly polkadotApi: PolkadotModule = PolkadotModule.inject()
  private readonly logger: ILoggerModule = LoggerModule.inject()

  async subscribeFinalizedHeads(): Promise<void> {
    if (!BlocksService.isSyncComplete()) {
      this.logger.error(`failed setup "subscribeFinalizedHeads": sync in process`)
      return
    }

    this.logger.info(`Starting subscribeFinalizedHeads`)

    await this.polkadotApi.subscribeFinalizedHeads((header) => {
      return this.onFinalizedHead(header)
    })
  }

  private async onFinalizedHead(blockHash: Header): Promise<void> {
    const blocksService: IBlocksService = new BlocksService()

    const blockNumberFromDB = await this.blockRepository.getLastProcessedBlock()

    if (blockHash.number.toNumber() === blockNumberFromDB) {
      return
    }

    this.logger.info(`Captured block "${blockHash.number}" with hash ${blockHash.hash}`)

    if (blockHash.number.toNumber() < blockNumberFromDB) {
      this.logger.info(`stash operation detected`)
      await blocksService.trimAndUpdateToFinalized(blockHash.number.toNumber())
    }

    try {
      await blocksService.processBlock(blockHash.number.toNumber(), false)
    } catch (error) {
      this.logger.error(`failed to process captured block #${blockHash}:`, error)
    }
  }
}

export { ConsumerService }

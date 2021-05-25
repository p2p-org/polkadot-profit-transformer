import { IConsumerService } from './consumer.types'
import { SyncStatus } from '../index'
import { BlocksService } from '../blocks/blocks'
import { Header } from '@polkadot/types/interfaces'
import { ApiPromise } from '@polkadot/api'
import { PolkadotModule } from '../../modules/polkadot.module'
import { Logger } from 'pino'
import { LoggerModule } from '../../modules/logger.module'

/**
 * Provides blocks streamer service
 * @class
 */
class ConsumerService implements IConsumerService {
  private readonly polkadotApi: ApiPromise = PolkadotModule.inject()
  private readonly logger: Logger = LoggerModule.inject()

  /**
   * Subscribe to finalized heads stream
   *
   * @async
   * @returns {Promise<void>}
   */
  async subscribeFinalizedHeads(): Promise<void> {
    if (SyncStatus.isLocked()) {
      this.logger.error(`failed setup "subscribeFinalizedHeads": sync in process`)
      return
    }

    this.logger.info(`Starting subscribeFinalizedHeads`)

    const blocksService = new BlocksService()

    const blockNumberFromDB = await blocksService.getLastProcessedBlock()

    if (blockNumberFromDB === 0) {
      this.logger.warn(`"subscribeFinalizedHeads" capture enabled but, not synchronized blocks `)
    }

    await this.polkadotApi.rpc.chain.subscribeFinalizedHeads((header) => {
      return this.onFinalizedHead(header)
    })
  }

  /**
   * Finalized headers capture handler
   *
   * @async
   * @private
   * @param {BlockHash} blockHash
   * @returns {Promise<void>}
   */
  private async onFinalizedHead(blockHash: Header): Promise<void> {
    const blocksService = new BlocksService()

    const blockNumberFromDB = await blocksService.getLastProcessedBlock()

    if (blockHash.number.toNumber() === blockNumberFromDB) {
      return
    }

    this.logger.info(`Captured block "${blockHash.number}" with hash ${blockHash.hash}`)

    if (blockHash.number.toNumber() < blockNumberFromDB) {
      this.logger.info(`stash operation detected`)
      await blocksService.trimAndUpdateToFinalized(blockHash.number.toNumber())
    }

    try {
      await blocksService.processBlock(blockHash.number.toNumber())
    } catch(error) {
      this.logger.error(`failed to process captured block #${blockHash}:`, error)
    }
  }
}

export { ConsumerService }

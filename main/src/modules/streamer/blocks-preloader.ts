import { BlockProcessor } from './block-processor'
import { PolkadotRepository } from '../../apps/common/infra/polkadotapi/polkadot.repository'
import { Logger } from '../../apps/common/infra/logger/logger'
import { StreamerRepository } from '../../apps/common/infra/postgresql/streamer.repository'

export type BlocksPreloader = ReturnType<typeof BlocksPreloader>

export const BlocksPreloader = (deps: {
  streamerRepository: StreamerRepository
  polkadotRepository: PolkadotRepository
  blockProcessor: BlockProcessor
  logger: Logger
  concurrency: number
}) => {
  const { streamerRepository, polkadotRepository, blockProcessor, logger, concurrency } = deps
  return async (startBlockParam?: number) => {
    logger.info('BlocksPreloader started with startBlockParam = ' + startBlockParam)
    const lastBlockIdInDb = await streamerRepository.blocks.findLastBlockId()
    console.log({ lastBlockIdInDb, type: typeof lastBlockIdInDb })
    const startBlockId = startBlockParam ?? (lastBlockIdInDb || 0)
    let lastBlockNumber = await polkadotRepository.getFinBlockNumber()
    logger.info('last finalized block id: ' + lastBlockNumber)

    let blockNumber: number = startBlockId

    while (blockNumber <= lastBlockNumber) {
      logger.info('BlocksPreloader: get new loop of 10 blocks from blockNumber=' + blockNumber)

      const processTasks = Array(concurrency)
        .fill('')
        .map((_, i) => {
          return blockProcessor(blockNumber + i)
        })

      await Promise.all(processTasks)

      blockNumber += concurrency

      console.log('next blockNumber', blockNumber)

      lastBlockNumber = await polkadotRepository.getFinBlockNumber()
    }
  }
}

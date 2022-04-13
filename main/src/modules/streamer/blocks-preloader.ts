import { BlockProcessor } from './block-processor'
import { PolkadotRepository } from '../../apps/common/infra/polkadotapi/polkadot.repository'
import { Logger } from '../../apps/common/infra/logger/logger'
import { StreamerRepository } from '../../apps/common/infra/postgresql/streamer.repository'
import { counter } from '@apps/common/infra/prometheus'

export enum PRELOADER_STATUS {
  IN_PROGRESS = 'preloading in progress',
  DONE = 'listening for finalized blocks',
}
export type BlocksPreloader = ReturnType<typeof BlocksPreloader>

export const BlocksPreloader = (deps: {
  streamerRepository: StreamerRepository
  polkadotRepository: PolkadotRepository
  blockProcessor: BlockProcessor
  logger: Logger
  concurrency: number
}) => {
  const { streamerRepository, polkadotRepository, blockProcessor, logger, concurrency } = deps
  let status = PRELOADER_STATUS.IN_PROGRESS
  let blockNumber = 0
  return {
    start: async (startBlockParam: number) => {
      logger.info('BlocksPreloader started with startBlockParam = ' + startBlockParam)
      const lastBlockIdInDb = await streamerRepository.blocks.findLastBlockId()
      const startBlockId = startBlockParam === -1 ? lastBlockIdInDb || 0 : startBlockParam
      let lastBlockNumber = await polkadotRepository.getFinBlockNumber()
      logger.info('last finalized block id: ' + lastBlockNumber)

      blockNumber = startBlockId
      counter.inc(blockNumber)

      while (blockNumber <= lastBlockNumber) {
        logger.info('BlocksPreloader: get new loop of 10 blocks from blockNumber=' + blockNumber)

        const processTasks = Array(concurrency)
          .fill('')
          .map((_, i) => blockProcessor(blockNumber + i))

        await Promise.all(processTasks)

        blockNumber += concurrency

        console.log('next blockNumber', blockNumber)

        if (blockNumber >= lastBlockNumber) lastBlockNumber = await polkadotRepository.getFinBlockNumber()
      }

      status = PRELOADER_STATUS.DONE
    },
    status: () => status,
    currentBlock: () => blockNumber,
  }
}

import { EventModel } from './../../apps/common/infra/postgresql/models/event.model'
import { StreamerRepository } from '../../apps/common/infra/postgresql/streamer.repository'
import { ExtrinsicsProcessor, ExtrinsicsProcessorInput } from './extrinsics-processor'
import { Logger } from 'apps/common/infra/logger/logger'
import { BlockModel } from 'apps/common/infra/postgresql/models/block.model'
import { EventBus } from 'utils/event-bus/event-bus'
import { EventsProcessor } from './events-processor'
import { PolkadotRepository } from '../../apps/common/infra/polkadotapi/polkadot.repository'
import { ExtrinsicModel } from 'apps/common/infra/postgresql/models/extrinsic.model'

export type BlockProcessor = ReturnType<typeof BlockProcessor>

export const BlockProcessor = (deps: {
  polkadotRepository: PolkadotRepository
  logger: Logger
  eventsProcessor: EventsProcessor
  extrinsicsProcessor: ExtrinsicsProcessor
  eventBus: EventBus
  streamerRepository: StreamerRepository
}) => {
  const { polkadotRepository, eventsProcessor, logger, extrinsicsProcessor, streamerRepository, eventBus } = deps
  logger.info('BlockProcessor initialized')

  return async (blockId: number) => {
    try {
      const blockHash = await polkadotRepository.getBlockHashByHeight(blockId)

      if (!blockHash) {
        throw new Error('cannot get block hash of blockId ' + blockId)
      }

      logger.info('BlockProcessor: start processing block with id: ' + blockId)

      const [sessionId, blockCurrentEra, activeEra, signedBlock, extHeader, blockTime, events] =
        await polkadotRepository.getInfoToProcessBlock(blockHash)

      const current_era = parseInt(blockCurrentEra.toString(), 10)
      const eraId = activeEra.isNone ? current_era : Number(activeEra.unwrap().get('index'))

      const extrinsicsData: ExtrinsicsProcessorInput = {
        eraId,
        sessionId: sessionId.toNumber(),
        blockNumber: signedBlock.block.header.number,
        events,
        extrinsics: signedBlock.block.extrinsics,
      }
      const extractedExtrinsics = await extrinsicsProcessor(extrinsicsData)

      const processedEvents = eventsProcessor(signedBlock.block.header.number.toNumber(), events, sessionId, eraId)

      const lastDigestLogEntryIndex = signedBlock.block.header.digest.logs.length - 1

      const blockModel: BlockModel = {
        id: signedBlock.block.header.number.toNumber(),
        hash: signedBlock.block.header.hash.toHex(),
        author: extHeader?.author ? extHeader.author.toString() : '',
        session_id: sessionId.toNumber(),
        current_era,
        era: eraId,
        state_root: signedBlock.block.header.stateRoot.toHex(),
        extrinsics_root: signedBlock.block.header.extrinsicsRoot.toHex(),
        parent_hash: signedBlock.block.header.parentHash.toHex(),
        last_log: lastDigestLogEntryIndex > -1 ? signedBlock.block.header.digest.logs[lastDigestLogEntryIndex].type : '',
        digest: signedBlock.block.header.digest.toString(),
        block_time: new Date(blockTime.toNumber()),
      }

      // save extrinsics events and block to main tables
      for (const extrinsic of extractedExtrinsics) {
        await streamerRepository.extrinsics.save(extrinsic)
      }

      for (const event of processedEvents) {
        // logger.info('BlockProcessor send to db eventModel: ' + JSON.stringify(event))
        await streamerRepository.events.save(event)
      }

      // logger.info('BlockProcessor send to db BlockModel: ' + JSON.stringify(blockModel))
      await streamerRepository.blocks.save(blockModel)

      // here targeted events and extrinsics send to the eventBus
      for (const extrinsic of extractedExtrinsics) {
        if (extrinsic.section === 'identity') {
          if (['clearIdentity', 'killIdentity', 'setFields', 'setIdentity'].includes(extrinsic.method)) {
            eventBus.dispatch<ExtrinsicModel>('identityExtrinsic', extrinsic)
          }
          if (['addSub', 'quitSub', 'removeSub', 'renameSub', 'setSubs'].includes(extrinsic.method)) {
            eventBus.dispatch<ExtrinsicModel>('subIdentityExtrinsic', extrinsic)
          }
        }
      }

      for (const event of processedEvents) {
        if (event.section === 'staking' && event.method === 'EraPayout') {
          logger.info('BlockProcessor eraPayout detected')
          eventBus.dispatch<EventModel>('eraPayout', event)
        }

        if (event.section === 'system') {
          if (['NewAccount', 'KilledAccount'].includes(event.method)) {
            eventBus.dispatch<EventModel>('identityEvent', event)
          }
        }

        if (event.section === 'identity') {
          if (['JudgementRequested', 'JudgementGiven', 'JudgementUnrequested'].includes(event.method)) {
            eventBus.dispatch<EventModel>('identityEvent', event)
          }
        }
      }
    } catch (error: any) {
      if (error.message === 'Unable to retrieve header and parent from supplied hash') return
      throw error
    }
  }
}

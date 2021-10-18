import { EventModel } from './../../apps/common/infra/postgresql/models/event.model'
import { StreamerRepository } from '../../apps/common/infra/postgresql/streamer.repository'
import { ExtrinsicsProcessor, ExtrinsicsProcessorInput } from './extrinsics-processor'
import { Logger } from 'apps/common/infra/logger/logger'
import { BlockModel } from 'apps/common/infra/postgresql/models/block.model'
import { EventBus } from 'utils/event-bus/event-bus'
import { EventsProcessor } from './events-processor'
import { PolkadotRepository } from '../../apps/common/infra/polkadotapi/polkadot.repository'
import { ExtrinsicModel } from 'apps/common/infra/postgresql/models/extrinsic.model'
import { ExtrincicProcessorInput } from '@modules/governance-processor/processors/extrinsics'

const sleep = async (ms: number): Promise<any> => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

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
    for (let attempts = 0; attempts < 5; attempts++) {
      console.log('attempt' + attempts)
      try {
        const blockHash = await polkadotRepository.getBlockHashByHeight(blockId)

        logger.info('BlockProcessor: start processing block with id: ' + blockId)

        const [signedBlock, extHeader, blockTime, events] = await polkadotRepository.getInfoToProcessBlock(blockHash)

        console.log(blockId + ': getInfoToProcessBlock done')

        const extrinsicsData: ExtrinsicsProcessorInput = {
          eraId: 0,
          sessionId: 0,
          blockNumber: signedBlock.block.header.number,
          events,
          extrinsics: signedBlock.block.extrinsics,
        }
        const extractedExtrinsics = await extrinsicsProcessor(extrinsicsData)
        console.log(blockId + ': extractedExtrinsics done')

        const processedEvents = eventsProcessor(signedBlock.block.header.number.toNumber(), events)

        console.log(blockId + ': processedEvents done')

        const lastDigestLogEntryIndex = signedBlock.block.header.digest.logs.length - 1

        const block: BlockModel = {
          id: signedBlock.block.header.number.toNumber(),
          hash: signedBlock.block.header.hash.toHex(),
          author: extHeader?.author ? extHeader.author.toString() : '',
          session_id: 0,
          current_era: 0,
          era: 0,
          state_root: signedBlock.block.header.stateRoot.toHex(),
          extrinsics_root: signedBlock.block.header.extrinsicsRoot.toHex(),
          parent_hash: signedBlock.block.header.parentHash.toHex(),
          last_log: lastDigestLogEntryIndex > -1 ? signedBlock.block.header.digest.logs[lastDigestLogEntryIndex].type : '',
          digest: signedBlock.block.header.digest.toString(),
          block_time: new Date(blockTime.toNumber()),
        }

        console.log(blockId + ': BlockModel created')

        // save extrinsics events and block to main tables
        for (const extrinsic of extractedExtrinsics) {
          await streamerRepository.extrinsics.save(extrinsic)
        }

        console.log(blockId + ': extrinsics saved')

        for (const event of processedEvents) {
          await streamerRepository.events.save(event)
        }

        console.log(blockId + ': events saved')

        await streamerRepository.blocks.save(block)

        console.log(blockId + ': block saved')

        // here we send needed events and successfull extrinsics to the eventBus
        for (const extrinsic of extractedExtrinsics) {
          if (!extrinsic.success) continue

          if (extrinsic.section === 'identity') {
            if (['clearIdentity', 'killIdentity', 'setFields', 'setIdentity'].includes(extrinsic.method)) {
              eventBus.dispatch<ExtrinsicModel>('identityExtrinsic', extrinsic)
            }
            if (['addSub', 'quitSub', 'removeSub', 'renameSub', 'setSubs'].includes(extrinsic.method)) {
              eventBus.dispatch<ExtrinsicModel>('subIdentityExtrinsic', extrinsic)
            }
          }

          if (['technicalCommittee', 'democracy', 'council', 'treasury', 'tips'].includes(extrinsic.section)) {
            // for governance processing we need extrinsics with corresponding events
            const extrinsicIndex = Number(extrinsic.id.split('-')[1])
            const extrinsicEvents = events.filter(
              ({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(extrinsicIndex),
            )
            const extrinsicEntry: ExtrincicProcessorInput = {
              extrinsic,
              events: extrinsicEvents,
              block: block,
            }
            eventBus.dispatch<ExtrincicProcessorInput>('governanceExtrinsic', extrinsicEntry)
          }
        }

        console.log(blockId + ': extrinsics send to eventBus')

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

          if (['technicalCommittee', 'democracy', 'council', 'treasury', 'tips'.includes(event.section)]) {
            eventBus.dispatch<EventModel>('governanceEvent', event)
          }
        }

        console.log(blockId + ': events send to eventBus')

        return
      } catch (error: any) {
        logger.error('BlockProcessor error: ', error.message)
        console.error('BlockProcessor error: ', error.message)
        if (error.message === 'Unable to retrieve header and parent from supplied hash') return
        await sleep(2000)
      }
    }
    console.log('Error process block after 5 atempts for blockId=' + blockId)
    throw Error('Error process block after 5 atempts for blockId=' + blockId)
  }
}

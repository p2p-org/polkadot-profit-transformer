// import { MultisigExtrinsicProcessor } from './processors/multisigExtrinsics/index'
import { EventProcessor } from './processors/events'
import { EventEntry, ExtrinsicsEntry } from './types'
import { Logger } from '../../apps/common/infra/logger/logger'
import { ExtrincicProcessorInput, ExtrinsicProcessor } from './processors/extrinsics'

export type GovernanceProcessor = ReturnType<typeof GovernanceProcessor>

export const GovernanceProcessor = (deps: {
  extrinsicProcessor: ExtrinsicProcessor
  eventProcessor: EventProcessor
  logger: Logger
  // multisigExtrinsicProcessor: MultisigExtrinsicProcessor
}) => {
  // const { extrinsicProcessor, eventProcessor, logger, multisigExtrinsicProcessor } = deps
  const { extrinsicProcessor, eventProcessor, logger } = deps

  return {
    processEventHandler: async (event: EventEntry): Promise<void> => {
      // console.log('EVENT_________________', { event })
      if (event.section === 'technicalCommittee') {
        if (event.method === 'Approved') return eventProcessor.technicalCommittee.approved(event)
        if (event.method === 'Executed') return eventProcessor.technicalCommittee.executed(event)
        if (event.method === 'Closed') return eventProcessor.technicalCommittee.closed(event)
        if (event.method === 'Disapproved') return eventProcessor.technicalCommittee.disapproved(event)
        if (event.method === 'MemberExecuted') return eventProcessor.technicalCommittee.memberExecuted(event)
      }
      if (event.section === 'democracy') {
        if (event.method === 'Started') return eventProcessor.democracy.referenda.started(event)
        if (event.method === 'Tabled') return eventProcessor.democracy.proposal.tabled(event)
        if (event.method === 'Cancelled') return eventProcessor.democracy.referenda.cancelled(event)
        if (event.method === 'Executed') return eventProcessor.democracy.referenda.executed(event)
        if (event.method === 'NotPassed') return eventProcessor.democracy.referenda.notpassed(event)
        if (event.method === 'Passed') return eventProcessor.democracy.referenda.passed(event)
        if (event.method === 'PreimageUsed') return eventProcessor.democracy.preimage.used(event)
      }
      if (event.section === 'council') {
        if (event.method === 'Approved') return eventProcessor.council.approved(event)
        if (event.method === 'Executed') return eventProcessor.council.executed(event)
        if (event.method === 'Closed') return eventProcessor.council.closed(event)
        if (event.method === 'Disapproved') return eventProcessor.council.disapproved(event)
        if (event.method === 'MemberExecuted') return eventProcessor.council.memberExecuted(event)
      }
      if (event.section === 'treasury') {
        if (event.method === 'Rejected') return eventProcessor.treasury.proposal.rejected(event)
        if (event.method === 'Awarded') return eventProcessor.treasury.proposal.awarded(event)
        if (event.method === 'TipClosed') return eventProcessor.treasury.tips.tipsclosed(event)
      }
      if (event.section === 'tips') {
        if (event.method === 'TipClosed') return eventProcessor.treasury.tips.tipsclosed(event)
      }
    },
    processExtrinsicsHandler: async (extrinsics: ExtrinsicsEntry): Promise<void> => {
      const processExtrinsic = (extrinsicExtendedData: ExtrincicProcessorInput) => {
        if (extrinsicExtendedData.fullExtrinsic.method.section === 'technicalCommittee') {
          if (extrinsicExtendedData.fullExtrinsic.method.method === 'propose')
            return extrinsicProcessor.technicalCommitee.propose(extrinsicExtendedData)
          if (extrinsicExtendedData.fullExtrinsic.method.method === 'vote')
            return extrinsicProcessor.technicalCommitee.vote(extrinsicExtendedData)
        }

        if (extrinsicExtendedData.fullExtrinsic.method.section === 'democracy') {
          if (extrinsicExtendedData.fullExtrinsic.method.method === 'vote')
            return extrinsicProcessor.democracy.referenda.vote(extrinsicExtendedData)
          if (extrinsicExtendedData.fullExtrinsic.method.method === 'propose')
            return extrinsicProcessor.democracy.proposal.propose(extrinsicExtendedData)
          if (extrinsicExtendedData.fullExtrinsic.method.method === 'second')
            return extrinsicProcessor.democracy.proposal.second(extrinsicExtendedData)
          if (extrinsicExtendedData.fullExtrinsic.method.method === 'removeVote')
            return extrinsicProcessor.democracy.referenda.removeVote(extrinsicExtendedData)
          // todo process below actions
          // if (extrinsic.method === 'removeOtherVote')
          //   return extrinsicProcessor.democracy.referenda.removeOtherVote(extrinsicExtendedData)
          if (extrinsicExtendedData.fullExtrinsic.method.method === 'notePreimage')
            return extrinsicProcessor.democracy.preimage.notePreimage(extrinsicExtendedData)
        }

        if (extrinsicExtendedData.fullExtrinsic.method.section === 'council') {
          if (extrinsicExtendedData.fullExtrinsic.method.method === 'propose')
            return extrinsicProcessor.council.propose(extrinsicExtendedData)
          if (extrinsicExtendedData.fullExtrinsic.method.method === 'vote') return extrinsicProcessor.council.vote(extrinsicExtendedData)
        }

        if (extrinsicExtendedData.fullExtrinsic.method.section === 'treasury') {
          if (extrinsicExtendedData.fullExtrinsic.method.method === 'proposeSpend')
            return extrinsicProcessor.treasury.propose(extrinsicExtendedData)
          if (extrinsicExtendedData.fullExtrinsic.method.method === 'reportAwesome')
            return extrinsicProcessor.tips.reportAwesome(extrinsicExtendedData)
          if (extrinsicExtendedData.fullExtrinsic.method.method === 'tip') return extrinsicProcessor.tips.tip(extrinsicExtendedData)
        }

        if (extrinsicExtendedData.fullExtrinsic.method.section === 'tips') {
          if (extrinsicExtendedData.fullExtrinsic.method.method === 'tipNew') return extrinsicProcessor.tips.tipNew(extrinsicExtendedData)
          if (extrinsicExtendedData.fullExtrinsic.method.method === 'tip') return extrinsicProcessor.tips.tip(extrinsicExtendedData)
        }
      }

      for (const extrinsic of extrinsics.extrinsics) {
        const isExtrinsicSuccessfull = await extrinsicProcessor.utils.isExtrinsicSuccessfull(extrinsic)
        if (!isExtrinsicSuccessfull) {
          logger.warn('extrinsic ' + extrinsic.id + ' is not successfull, skip')
          continue
        }

        const fullExtrinsic = await extrinsicProcessor.utils.getExtrinsic(extrinsic)

        if (['technicalCommittee', 'democracy', 'council', 'treasury', 'tips'].includes(fullExtrinsic.method.section)) {
          // we will need full extrinsics and events for processing, extract here
          const { extrinsicEvents, block } = await extrinsicProcessor.utils.getActionData(extrinsic)

          const extrinsicExtendedData: ExtrincicProcessorInput = { extrinsic, extrinsicEvents, fullExtrinsic, block }

          // process successfull extrinsics

          console.log({ extrinsic })

          processExtrinsic(extrinsicExtendedData)
        }
      }
    },
  }
}

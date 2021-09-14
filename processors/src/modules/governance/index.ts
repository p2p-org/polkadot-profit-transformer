import { MultisigExtrinsicProcessor } from './processors/multisigExtrinsics/index'
import { EventProcessor } from './processors/events'
import { EventEntry, ExtrinsicsEntry } from './types'
import { Logger } from '../../apps/common/infra/logger/logger'
import { ExtrinsicProcessor } from './processors/extrinsics'

export type GovernanceProcessor = ReturnType<typeof GovernanceProcessor>

export const GovernanceProcessor = (deps: {
  extrinsicProcessor: ExtrinsicProcessor
  eventProcessor: EventProcessor
  logger: Logger
  multisigExtrinsicProcessor: MultisigExtrinsicProcessor
}) => {
  const { extrinsicProcessor, eventProcessor, logger, multisigExtrinsicProcessor } = deps

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
        if (event.method === 'Cancelled') return eventProcessor.democracy.referenda.cancelled(event)
        if (event.method === 'Executed') return eventProcessor.democracy.referenda.executed(event)
        if (event.method === 'NotPassed') return eventProcessor.democracy.referenda.notpassed(event)
        if (event.method === 'Passed') return eventProcessor.democracy.referenda.passed(event)
        if (event.method === 'PreimageUsed') return eventProcessor.democracy.preimage.used(event)

        // if (event.method === 'Tabled') return eventProcessor.democracy.proposal.tabled(event)
      }
    },
    processExtrinsicsHandler: async (extrinsics: ExtrinsicsEntry): Promise<void> => {
      for (const extrinsic of extrinsics.extrinsics) {
        // logger.info({ extrinsic }, 'process tech comm extrinsic')

        if (extrinsic.section === 'technicalCommittee') {
          if (extrinsic.method === 'propose') return extrinsicProcessor.technicalCommitee.propose(extrinsic)
          if (extrinsic.method === 'vote') return extrinsicProcessor.technicalCommitee.vote(extrinsic)
        }

        if (extrinsic.section === 'democracy') {
          if (extrinsic.method === 'vote') return extrinsicProcessor.democracy.referenda.vote(extrinsic)
          //   if (extrinsic.method === 'removeVote') return extrinsicProcessor.democracy.referenda.removeVote(extrinsic)
          //   if (extrinsic.method === 'removeOtherVote') return extrinsicProcessor.democracy.referenda.removeOtherVote(extrinsic)
          //   if (extrinsic.method === 'propose') return extrinsicProcessor.democracy.proposal.propose(extrinsic)
          //   if (extrinsic.method === 'second') return extrinsicProcessor.democracy.proposal.second(extrinsic)
          if (extrinsic.method === 'notePreimage') return extrinsicProcessor.democracy.preimage.notePreimage(extrinsic)
        }

        if (extrinsic.section === 'multisig') {
          if (extrinsic.method === 'asMulti') {
            return multisigExtrinsicProcessor.asMulti(extrinsic)
          }
        }
      }
    },
  }
}

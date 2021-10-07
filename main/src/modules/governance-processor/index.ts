import { EventModel } from './../../apps/common/infra/postgresql/models/event.model'
import { EventProcessor } from './processors/events'
import { Logger } from '../../apps/common/infra/logger/logger'
import { ExtrincicProcessorInput, ExtrinsicProcessor } from './processors/extrinsics'

export type GovernanceProcessor = ReturnType<typeof GovernanceProcessor>

export const GovernanceProcessor = (deps: {
  extrinsicProcessor: ExtrinsicProcessor
  eventProcessor: EventProcessor
  logger: Logger
}) => {
  const { extrinsicProcessor, eventProcessor, logger } = deps

  return {
    processEventHandler: async (event: EventModel): Promise<void> => {
      try {
        if (event.section === 'technicalCommittee') {
          if (event.method === 'Approved') return eventProcessor.technicalCommittee.approved(event)
          if (event.method === 'Executed') return eventProcessor.technicalCommittee.executed(event)
          if (event.method === 'Closed') return eventProcessor.technicalCommittee.closed(event)
          if (event.method === 'Disapproved') return eventProcessor.technicalCommittee.disapproved(event)
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
      } catch (error) {
        console.log('error in block id: ' + event.block_id)
        throw error
      }
    },
    processExtrinsicsHandler: async (extrinsicEntry: ExtrincicProcessorInput): Promise<void> => {
      console.log('process extrinsic ' + extrinsicEntry.extrinsic.id)

      // process successfull extrinsics

      if (extrinsicEntry.extrinsic.section === 'technicalCommittee') {
        if (extrinsicEntry.extrinsic.method === 'propose') return extrinsicProcessor.technicalCommitee.propose(extrinsicEntry)
        if (extrinsicEntry.extrinsic.method === 'vote') return extrinsicProcessor.technicalCommitee.vote(extrinsicEntry)
      }

      if (extrinsicEntry.extrinsic.section === 'democracy') {
        if (extrinsicEntry.extrinsic.method === 'vote') return extrinsicProcessor.democracy.referenda.vote(extrinsicEntry)
        if (extrinsicEntry.extrinsic.method === 'propose') return extrinsicProcessor.democracy.proposal.propose(extrinsicEntry)
        if (extrinsicEntry.extrinsic.method === 'second') return extrinsicProcessor.democracy.proposal.second(extrinsicEntry)
        if (extrinsicEntry.extrinsic.method === 'removeVote')
          return extrinsicProcessor.democracy.referenda.removeVote(extrinsicEntry)
        if (extrinsicEntry.extrinsic.method === 'removeOtherVote')
          return extrinsicProcessor.democracy.referenda.removeOtherVote(extrinsicEntry)
        if (extrinsicEntry.extrinsic.method === 'notePreimage')
          return extrinsicProcessor.democracy.preimage.notePreimage(extrinsicEntry)
      }

      if (extrinsicEntry.extrinsic.section === 'council') {
        if (extrinsicEntry.extrinsic.method === 'propose') return extrinsicProcessor.council.propose(extrinsicEntry)
        if (extrinsicEntry.extrinsic.method === 'vote') return extrinsicProcessor.council.vote(extrinsicEntry)
      }

      if (extrinsicEntry.extrinsic.section === 'treasury') {
        if (extrinsicEntry.extrinsic.method === 'proposeSpend') return extrinsicProcessor.treasury.propose(extrinsicEntry)
        if (extrinsicEntry.extrinsic.method === 'reportAwesome') return extrinsicProcessor.tips.reportAwesome(extrinsicEntry)
        if (extrinsicEntry.extrinsic.method === 'tip') return extrinsicProcessor.tips.tip(extrinsicEntry)
      }

      if (extrinsicEntry.extrinsic.section === 'tips') {
        if (extrinsicEntry.extrinsic.method === 'tipNew') return extrinsicProcessor.tips.tipNew(extrinsicEntry)
        if (extrinsicEntry.extrinsic.method === 'tip') return extrinsicProcessor.tips.tip(extrinsicEntry)
      }
    },
  }
}

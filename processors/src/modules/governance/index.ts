import { EventProcessor } from './processors/events'
import { EventEntry, ExtrinsicsEntry } from './types'
import { Logger } from '../../apps/common/infra/logger/logger'
import { ExtrinsicProcessor } from './processors/extrinsics'

// const findEventDataEntryByName = (eventRawData: string, fieldName: string) => {
//   const eventData = JSON.parse(eventRawData)
//   const entry = eventData.find((dataEntry: Record<string, any>) => dataEntry[fieldName])
//   if (!entry) return
//   return entry[fieldName]
// }
// const findEventDataByIndexAndName = (eventRawData: string, index: number, name: string) => {
//   const eventData = JSON.parse(eventRawData)
//   return eventData[index][name]
// }

export type GovernanceProcessor = ReturnType<typeof GovernanceProcessor>

export const GovernanceProcessor = (deps: { extrinsicProcessor: ExtrinsicProcessor; eventProcessor: EventProcessor; logger: Logger }) => {
  const { extrinsicProcessor, eventProcessor, logger } = deps
  // const processProposalProposedEvent = async (event: EventEntry) => {
  //   const proposal: TechnicalCommiteeProposalModel = {
  //     id: parseInt(findEventDataEntryByName(event.data, 'ProposalIndex'), 16),
  //     motion_hash: findEventDataEntryByName(event.data, 'Hash'),
  //     member_treshold: parseInt(findEventDataEntryByName(event.data, 'MemberCount'), 16),
  //     proposer: findEventDataEntryByName(event.data, 'AccountId'),
  //     created_at_block: event.block_id,
  //     updated_at_block: event.block_id,
  //     status: 'proposed'
  //   }

  //   await governanceRepository.saveTechnicalCommiteeProposal(proposal)
  // }

  // const processProposalVotedEvent = async (event: EventEntry) => {
  //   // create vote entry
  //   const proposalVote: TechnicalCommiteeProposalVoteModel = {
  //     motion_hash: findEventDataEntryByName(event.data, 'Hash'),
  //     block_id: event.block_id,
  //     account_id: findEventDataEntryByName(event.data, 'AccountId'),
  //     voted: findEventDataEntryByName(event.data, 'bool'),
  //     yes: findEventDataByIndexAndName(event.data, 3, 'MemberCount'),
  //     no: findEventDataByIndexAndName(event.data, 4, 'MemberCount')
  //   }
  //   await governanceRepository.createTechnicalCommiteeProposalVote(proposalVote)

  //   // update proposal updated_at_block
  //   const proposal = await governanceRepository.findProposalByMotionHash(findEventDataEntryByName(event.data, 'Hash'))
  //   if (!proposal) throw Error('No proposal found with motion hash: ' + findEventDataEntryByName(event.data, 'Hash'))

  //   await governanceRepository.saveTechnicalCommiteeProposal({
  //     ...proposal,
  //     updated_at_block: event.block_id
  //   })
  // }

  return {
    processEventHandler: async (event: EventEntry): Promise<void> => {
      console.log('EVENT_________________', { event })
      if (event.section === 'technicalCommittee') {
        if (event.method === 'Proposed') return eventProcessor.technicalCommittee.proposed(event)
        if (event.method === 'Voted') return eventProcessor.technicalCommittee.voted(event)
        if (event.method === 'Approved') return eventProcessor.technicalCommittee.approved(event)
        if (event.method === 'Executed') return eventProcessor.technicalCommittee.executed(event)
        if (event.method === 'Disapproved') return eventProcessor.technicalCommittee.disapproved(event)
        if (event.method === 'MemberExecuted') return eventProcessor.technicalCommittee.memberExecuted(event)
      }
      if (event.section === 'democracy') {
        if (event.method === 'Started') return eventProcessor.democracy.referenda.started(event)
        if (event.method === 'Cancelled') return eventProcessor.democracy.referenda.cancelled(event)
        if (event.method === 'Executed') return eventProcessor.democracy.referenda.executed(event)
        if (event.method === 'NotPassed') return eventProcessor.democracy.referenda.notpassed(event)
        if (event.method === 'Passed') return eventProcessor.democracy.referenda.passed(event)
        if (event.method === 'Tabled') return eventProcessor.democracy.proposal.tabled(event)
      }
    },
    processExtrinsicsHandler: async (extrinsics: ExtrinsicsEntry): Promise<void> => {
      for (const extrinsic of extrinsics.extrinsics) {
        logger.info({ extrinsic }, 'process tech comm extrinsic')

        if (extrinsic.section === 'technicalCommittee') {
          if (extrinsic.method === 'propose') return extrinsicProcessor.technicalCommitee.propose(extrinsic)
        }

        if (extrinsic.section === 'democracy') {
          if (extrinsic.method === 'vote') return extrinsicProcessor.democracy.referenda.vote(extrinsic)
          if (extrinsic.method === 'propose') return extrinsicProcessor.democracy.proposal.propose(extrinsic)
          if (extrinsic.method === 'second') return extrinsicProcessor.democracy.proposal.second(extrinsic)
        }
      }
    },
  }
}

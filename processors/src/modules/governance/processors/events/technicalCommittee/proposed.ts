import { GovernanceRepository } from '../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { EventEntry } from '@modules/governance/types'
import { Logger } from 'apps/common/infra/logger/logger'
import { TechnicalCommiteeProposalModel } from 'apps/common/infra/postgresql/governance/models/technicalCommiteeModels'

export const processTechnicalCommitteeProposedEvent = async (
  event: EventEntry,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  console.log('process tech comm propose event')
  logger.info({ event }, 'process technical commitee proposed event')

  const eventData = JSON.parse(event.data)
  const proposedBy = eventData[0]['AccountId']
  const hash = eventData[2]['Hash']
  const proposalIndex = parseInt(eventData[1]['ProposalIndex'], 16)
  const memberThreshold = parseInt(eventData[3]['MemberCount'], 16)

  const proposal: TechnicalCommiteeProposalModel = {
    hash,
    id: proposalIndex,
    block_id: event.block_id,
    event_id: event.event_id,
    event: 'Proposed',
    data: { proposedBy, proposalIndex, motionHash: hash, memberThreshold },
  }

  await governanceRepository.technicalCommittee.save(proposal)
}

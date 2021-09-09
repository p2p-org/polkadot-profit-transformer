import { GovernanceRepository } from '../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { EventEntry } from '@modules/governance/types'
import { Logger } from 'apps/common/infra/logger/logger'
import { TechnicalCommiteeProposalModel } from 'apps/common/infra/postgresql/governance/models/technicalCommiteeModels'

export const processTechnicalCommitteeVotedEvent = async (
  event: EventEntry,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'process technical commitee voted event')

  const eventData = JSON.parse(event.data)

  const hash = eventData[1]['Hash']
  const votedAccount = eventData[0]['AccountId']
  const vote = eventData[2].bool ? 'Aye' : 'Nay'
  const ayeVotesCount = parseInt(eventData[3]['MemberCount'], 16)
  const nayVotesCount = parseInt(eventData[4]['MemberCount'], 16)

  const proposal_id = await governanceRepository.technicalCommittee.findProposalIdByHash(hash)
  console.trace({ proposal_id })
  const proposal: TechnicalCommiteeProposalModel = {
    hash: hash,
    id: proposal_id,
    block_id: event.block_id,
    event_id: event.event_id,
    event: 'Voted',
    data: { votedAccount, vote, ayeVotesCount, nayVotesCount },
  }

  await governanceRepository.technicalCommittee.save(proposal)
}

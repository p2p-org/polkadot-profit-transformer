import { Logger } from 'apps/common/infra/logger/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { EventModel } from 'apps/common/infra/postgresql/models/event.model'
import { TreasuryProposalModel } from 'apps/common/infra/postgresql/models/treasuryProposal.model'

export const processTreasuryAwardedEvent = async (
  event: EventModel,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'process treasury rejected event')

  const eventData = JSON.parse(event.data)

  const proposal_id = parseInt(eventData[0]['ProposalIndex'], 16)
  const balance = parseInt(eventData[1]['Balance'], 16)

  const proposal: TreasuryProposalModel = {
    id: proposal_id,
    block_id: event.block_id,
    event_id: event.id,
    extrinsic_id: '',
    event: 'Awarded',
    data: { balance, accountId: eventData[2]['AccountId'] },
  }

  await governanceRepository.treasury.proposal.save(proposal)
}

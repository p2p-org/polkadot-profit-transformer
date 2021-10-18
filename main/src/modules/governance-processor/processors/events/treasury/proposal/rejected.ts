import { Logger } from 'apps/common/infra/logger/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { EventModel } from 'apps/common/infra/postgresql/models/event.model'
import { TreasuryProposalModel } from 'apps/common/infra/postgresql/models/treasuryProposal.model'

export const processTreasuryRejectedEvent = async (
  event: EventModel,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'process treasury rejected event')

  const eventData = event.event.data

  const proposal_id = parseInt(eventData[0], 16)
  const balance = parseInt(eventData[1], 16)

  const proposal: TreasuryProposalModel = {
    id: proposal_id,
    block_id: event.block_id,
    event_id: event.id,
    extrinsic_id: '',
    event: 'Rejected',
    data: { balance },
  }

  await governanceRepository.treasury.proposal.save(proposal)
}

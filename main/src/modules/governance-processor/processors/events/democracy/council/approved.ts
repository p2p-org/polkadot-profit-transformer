import { H256 } from '@polkadot/types/interfaces'
import { Logger } from 'loaders/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { CouncilProposalModel } from '@/models/councilMotions.model'
import { EventModel } from '@/models/event.model'

export const processCouncilApprovedEvent = async (
  event: EventModel,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'process council approved event')

  const hash = (<H256>event.event.data[0]).toString()
  const proposal_id = await governanceRepository.council.findProposalIdByHash(hash)

  const proposal: CouncilProposalModel = {
    hash,
    id: proposal_id,
    block_id: event.block_id,
    extrinsic_id: '',
    event_id: event.id,
    event: 'Approved',
    data: {},
  }

  await governanceRepository.council.save(proposal)
}

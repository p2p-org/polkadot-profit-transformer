import { H256 } from '@polkadot/types/interfaces'
import { Logger } from 'apps/common/infra/logger/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { CouncilProposalModel } from 'apps/common/infra/postgresql/models/councilMotions.model'
import { EventModel } from 'apps/common/infra/postgresql/models/event.model'

export const processCouncilMemberExecutedEvent = async (
  event: EventModel,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'process council member executed event')

  const eventData = event.event.data

  const hash = (<H256>eventData[0]).toString()
  const proposal_id = await governanceRepository.council.findProposalIdByHash(hash)

  const result = eventData[0] ? 'Ok' : 'Not ok'

  const proposal: CouncilProposalModel = {
    hash,
    id: proposal_id,
    block_id: event.block_id,
    extrinsic_id: '',
    event_id: event.id,
    event: 'MemberExecuted',
    data: { result },
  }

  await governanceRepository.council.save(proposal)
}

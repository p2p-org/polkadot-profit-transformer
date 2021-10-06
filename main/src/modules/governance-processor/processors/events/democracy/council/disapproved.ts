import { GovernanceRepository } from 'apps/common/infra/postgresql/governance/governance.repository'
import { EventEntry } from '@modules/governance-processor/types'
import { Logger } from 'apps/common/infra/logger/logger'
import { CouncilProposalModel } from 'apps/common/infra/postgresql/governance/models/councilMotions.model'

export const processCouncilDisapprovedEvent = async (
  event: EventEntry,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'process council disapproved event')

  const eventData = JSON.parse(event.data)

  const hash = eventData[0]['Hash']
  const proposal_id = await governanceRepository.council.findProposalIdByHash(hash)

  const proposal: CouncilProposalModel = {
    hash,
    id: proposal_id,
    block_id: event.block_id,
    event_id: event.event_id,
    extrinsic_id: '',
    event: 'Disapproved',
    data: {},
  }

  await governanceRepository.council.save(proposal)
}

import { GovernanceRepository } from 'apps/common/infra/postgresql/governance/governance.repository'
import { DemocracyReferendaModel } from 'apps/common/infra/postgresql/governance/models/democracyModels'

export const processDemocracyPreimageUsedEvent = async (event: EventEntry, governanceRepository: GovernanceRepository, logger: Logger) => {
  logger.trace({ event }, 'process democracy preimage used event')

  const eventData = JSON.parse(event.data)
  const referendumIndex = parseInt(eventData[0]['ReferendumIndex'], 16)

  console.log('preimageUsed event data', eventData)

  const democracyReferenda: DemocracyReferendaModel = {
    id: referendumIndex,
    block_id: event.block_id,
    event_id: event.event_id,
    extrinsic_id: '',
    event: 'PreimageUsed',
    data: {},
  }

  await governanceRepository.democracy.referenda.save(democracyReferenda)
}

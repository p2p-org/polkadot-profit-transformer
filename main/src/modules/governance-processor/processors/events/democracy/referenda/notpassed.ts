import { Logger } from 'loaders/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { DemocracyReferendaModel } from 'apps/common/infra/postgresql/models/democracy.model'
import { EventModel } from 'apps/common/infra/postgresql/models/event.model'

export const processDemocracyReferendaNotPassed = async (
  event: EventModel,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'process democracy referenda not passed event')
  const eventData = event.event.data
  const referendumIndex = parseInt(eventData[0], 16)

  const democracyReferenda: DemocracyReferendaModel = {
    id: referendumIndex,
    block_id: event.block_id,
    event_id: event.id,
    extrinsic_id: '',
    event: 'NotPassed',
    data: {},
  }

  await governanceRepository.democracy.referenda.save(democracyReferenda)
}

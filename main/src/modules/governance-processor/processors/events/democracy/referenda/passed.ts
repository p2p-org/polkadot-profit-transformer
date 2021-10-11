import { Logger } from 'apps/common/infra/logger/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { DemocracyReferendaModel } from 'apps/common/infra/postgresql/models/democracy.model'
import { EventModel } from 'apps/common/infra/postgresql/models/event.model'

export const processDemocracyReferendaPassed = async (
  event: EventModel,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'process democracy referenda passed event')
  const eventData = event.data
  console.log(eventData)
  const referendumIndex = parseInt(eventData[0]['ReferendumIndex'], 16)

  const democracyReferenda: DemocracyReferendaModel = {
    id: referendumIndex,
    block_id: event.block_id,
    event_id: event.id,
    extrinsic_id: '',
    event: 'Passed',
    data: {},
  }

  await governanceRepository.democracy.referenda.save(democracyReferenda)
}

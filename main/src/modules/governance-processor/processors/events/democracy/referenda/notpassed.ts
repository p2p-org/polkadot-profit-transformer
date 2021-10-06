import { EventEntry } from '@modules/governance-processor/types'
import { Logger } from 'apps/common/infra/logger/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance/governance.repository'
import { DemocracyReferendaModel } from 'apps/common/infra/postgresql/governance/models/democracy.model'

export const processDemocracyReferendaNotPassed = async (
  event: EventEntry,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'process democracy referenda not passed event')
  const eventData = JSON.parse(event.data)
  console.log(eventData)
  const referendumIndex = parseInt(eventData[0]['ReferendumIndex'], 16)

  const democracyReferenda: DemocracyReferendaModel = {
    id: referendumIndex,
    block_id: event.block_id,
    event_id: event.event_id,
    extrinsic_id: '',
    event: 'NotPassed',
    data: {},
  }

  await governanceRepository.democracy.referenda.save(democracyReferenda)
}

import { DemocracyReferendaModel } from './../../../../../../apps/common/infra/postgresql/governance/models/democracyModels'
import { EventEntry } from '@modules/governance/types'
import { Logger } from 'apps/common/infra/logger/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance/governance.repository'

export const processDemocracyReferendaStarted = async (
  event: EventEntry,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'process democracy referenda started event')

  const eventData = JSON.parse(event.data)
  const referendumIndex = parseInt(eventData[0]['ReferendumIndex'], 16)
  const voteThreshold = eventData[1]['VoteThreshold']

  console.log(eventData)

  const democracyReferenda: DemocracyReferendaModel = {
    id: referendumIndex,
    block_id: event.block_id,
    event_id: event.event_id,
    extrinsic_id: '',
    event: 'Started',
    data: { voteThreshold },
  }

  await governanceRepository.democracy.referenda.save(democracyReferenda)
}

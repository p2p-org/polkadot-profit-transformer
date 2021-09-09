import { DemocracyProposalModel } from './../../../../../../apps/common/infra/postgresql/governance/models/democracyModels'
import { EventEntry } from '@modules/governance/types'
import { Logger } from 'apps/common/infra/logger/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance/governance.repository'
import { DemocracyReferendaModel } from 'apps/common/infra/postgresql/governance/models/democracyModels'

export const processDemocracyProposalTabled = async (
  event: EventEntry,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'process democracy proposal tabled event')
  const eventData = JSON.parse(event.data)
  console.log(eventData)

  const proposalIndex = parseInt(eventData[0]['PropIndex'], 16)
  const balance = parseInt(eventData[1]['Balance'], 16)
  const depositors = eventData[2]['Vec<AccountId>']

  const proposal: DemocracyProposalModel = {
    id: proposalIndex,
    hash: '',
    block_id: event.block_id,
    event_id: event.event_id,
    extrinsic_id: '',
    event: 'Tabled',
    data: { balance, depositors },
  }

  await governanceRepository.democracy.proposal.save(proposal)
}

import { ApiPromise } from '@polkadot/api'
import { DemocracyProposalModel } from './../../../../../../apps/common/infra/postgresql/governance/models/democracyModels'
import { EventEntry } from '@modules/governance/types'
import { Logger } from 'apps/common/infra/logger/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance/governance.repository'
import { DemocracyReferendaModel } from 'apps/common/infra/postgresql/governance/models/democracyModels'

export const processDemocracyProposalTabled = async (
  event: EventEntry,
  governanceRepository: GovernanceRepository,
  logger: Logger,
  polkadotApi: ApiPromise,
): Promise<void> => {
  logger.trace({ event }, 'process democracy proposal tabled event')
  const eventData = JSON.parse(event.data)
  console.log(eventData)

  const proposalIndex = parseInt(eventData[0]['PropIndex'], 16)
  const balance = parseInt(eventData[1]['Balance'], 16)
  const depositors = eventData[2]['Vec<AccountId>']

  // find referenda started in this block (democracy.started event). this proposal become referenda here

  const blockHash = await polkadotApi.rpc.chain.getBlockHash(event.block_id)
  const blockEvents = await polkadotApi.query.system.events.at(blockHash)

  const democracyStartedEvent = blockEvents.find((event) => event.event.section === 'democracy' && event.event.method === 'Started')

  console.log('democracyStartedEvent: ', democracyStartedEvent?.toHuman())

  if (!democracyStartedEvent) {
    logger.error('no democracy started event for tabled proposal in block ' + event.block_id)
    return
  }

  const referendumIndex = parseInt(democracyStartedEvent.event.data[0].toHex(), 16)
  const voteThreshold = democracyStartedEvent.event.data[1].toString()

  // create proposal tabled record

  const proposal: DemocracyProposalModel = {
    id: proposalIndex,
    hash: '',
    block_id: event.block_id,
    event_id: event.event_id,
    extrinsic_id: '',
    event: 'Tabled',
    data: { balance, depositors, referendumIndex },
  }

  // create referenda started record

  const democracyReferenda: DemocracyReferendaModel = {
    id: referendumIndex,
    block_id: event.block_id,
    event_id: event.event_id,
    extrinsic_id: '',
    event: 'Started',
    data: { voteThreshold },
  }

  await Promise.all([
    governanceRepository.democracy.referenda.save(democracyReferenda),
    governanceRepository.democracy.proposal.save(proposal),
  ])
}

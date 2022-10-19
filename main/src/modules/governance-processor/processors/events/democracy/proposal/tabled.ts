import { ApiPromise } from '@polkadot/api'
import { Logger } from 'loaders/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { DemocracyProposalModel, DemocracyReferendaModel } from '@/models/democracy.model'
import { EventModel } from '@/models/event.model'

export const processDemocracyProposalTabled = async (
  event: EventModel,
  governanceRepository: GovernanceRepository,
  logger: Logger,
  polkadotApi: ApiPromise,
): Promise<void> => {
  console.log('process democracy proposal tabled event')
  const eventData = event.event.data

  const proposalIndex = parseInt(eventData[0], 16)
  const balance = parseInt(eventData[1], 16)
  const depositors = eventData[2]

  // find referenda started in this block (democracy.started event). this proposal become referenda here

  const blockHash = await polkadotApi.rpc.chain.getBlockHash(event.block_id)
  const blockEvents = await polkadotApi.query.system.events.at(blockHash)

  const democracyStartedEvent = blockEvents.find(
    (event) => event.event.section === 'democracy' && event.event.method === 'Started',
  )

  if (!democracyStartedEvent) {
    logger.error('no democracy started event for tabled proposal in block ' + event.block_id)
    return
  }

  const referendumIndex = parseInt(democracyStartedEvent.event.data[0].toHex(), 16)
  const voteThreshold = democracyStartedEvent.event.data[1].toString()

  // create proposal tabled record

  const proposal: DemocracyProposalModel = {
    id: proposalIndex,
    hash: '', // todo why no hash?
    block_id: event.block_id,
    event_id: event.id,
    extrinsic_id: '',
    event: 'Tabled',
    data: { balance, depositors, referendumIndex },
  }

  // create referenda started record

  const democracyReferenda: DemocracyReferendaModel = {
    id: referendumIndex,
    block_id: event.block_id,
    event_id: event.id,
    extrinsic_id: '',
    event: 'Started',
    data: { voteThreshold },
  }

  await Promise.all([
    governanceRepository.democracy.referenda.save(democracyReferenda),
    governanceRepository.democracy.proposal.save(proposal),
  ])
}

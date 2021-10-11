import { u32 } from '@polkadot/types'
import { H256 } from '@polkadot/types/interfaces'
import { Logger } from 'apps/common/infra/logger/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { CouncilProposalModel } from 'apps/common/infra/postgresql/models/councilMotions.model'
import { EventModel } from 'apps/common/infra/postgresql/models/event.model'

export const processCouncilClosedEvent = async (
  event: EventModel,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'council commitee closed event')

  const eventData = event.data

  const hash = (<H256>eventData[0]['Hash']).toString()
  // const techCommProposal = await governanceRepository.technicalCommittee.findProposalByHash(hash)

  // if (!techCommProposal) throw Error('no tech com proposal found for council closed event ' + event.event_id)

  const ayeVotesCount = (<u32>eventData[1]['MemberCount']).toNumber()
  const nayVotesCount = (<u32>eventData[2]['MemberCount']).toNumber()

  const proposal: CouncilProposalModel = {
    hash,
    id: 0, //todo techCommProposal.id,
    block_id: event.block_id,
    extrinsic_id: '',
    event_id: event.id,
    event: 'Closed',
    data: { ayeVotesCount, nayVotesCount },
  }

  await governanceRepository.council.save(proposal)
}

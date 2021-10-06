import { GovernanceRepository } from 'apps/common/infra/postgresql/governance/governance.repository'
import { EventEntry } from '@modules/governance-processor/types'
import { Logger } from 'apps/common/infra/logger/logger'
import { CouncilProposalModel } from 'apps/common/infra/postgresql/governance/models/councilMotions.model'

export const processCouncilClosedEvent = async (
  event: EventEntry,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'council commitee closed event')

  const eventData = JSON.parse(event.data)

  const hash = eventData[0]['Hash']
  // const techCommProposal = await governanceRepository.technicalCommittee.findProposalByHash(hash)

  // if (!techCommProposal) throw Error('no tech com proposal found for council closed event ' + event.event_id)

  const ayeVotesCount = parseInt(eventData[1]['MemberCount'], 16)
  const nayVotesCount = parseInt(eventData[2]['MemberCount'], 16)

  const proposal: CouncilProposalModel = {
    hash,
    id: 0, //todo techCommProposal.id,
    block_id: event.block_id,
    extrinsic_id: '',
    event_id: event.event_id,
    event: 'Closed',
    data: { ayeVotesCount, nayVotesCount },
  }

  await governanceRepository.council.save(proposal)
}

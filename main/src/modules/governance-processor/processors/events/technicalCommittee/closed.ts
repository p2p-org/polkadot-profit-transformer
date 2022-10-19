import { H256 } from '@polkadot/types/interfaces'
import { Logger } from 'loaders/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { EventModel } from '@/models/event.model'
import { TechnicalCommiteeProposalModel } from '@/models/technicalCommittee.model'

export const processTechnicalCommitteeClosedEvent = async (
  event: EventModel,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'process technical commitee closed event')

  const eventData = event.event.data
  const hash = (<H256>eventData[0]).toString()

  // const techCommProposal = await governanceRepository.technicalCommittee.findProposalByHash(hash)
  // if (!techCommProposal) throw Error('no tech com proposal found for tech comm closed event ' + event.event_id)

  const ayeVotesCount = parseInt(eventData[1], 16)
  const nayVotesCount = parseInt(eventData[2], 16)

  const proposal: TechnicalCommiteeProposalModel = {
    hash,
    id: null, // todo techCommProposal.id,
    block_id: event.block_id,
    extrinsic_id: '',
    event_id: event.id,
    event: 'Closed',
    data: { ayeVotesCount, nayVotesCount },
  }

  await governanceRepository.technicalCommittee.save(proposal)
}

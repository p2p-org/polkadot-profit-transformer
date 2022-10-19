import { H256 } from '@polkadot/types/interfaces'
import { Logger } from 'loaders/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { EventModel } from '@/models/event.model'
import { TechnicalCommiteeProposalModel } from '@/models/technicalCommittee.model'

export const processTechnicalCommitteeDisapprovedEvent = async (
  event: EventModel,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'process technical commitee disapproved event')

  const eventData = event.event.data

  const hash = (<H256>eventData[0]).toString()
  // const techCommProposal = await governanceRepository.technicalCommittee.findProposalByHash(hash)
  // if (!techCommProposal) throw Error('no tech com proposal found for tech comm disapproved closed event ' + event.event_id)

  const proposal: TechnicalCommiteeProposalModel = {
    hash,
    id: null, //todo techCommProposal.id,
    block_id: event.block_id,
    extrinsic_id: '',
    event_id: event.id,
    event: 'Disapproved',
    data: {},
  }

  await governanceRepository.technicalCommittee.save(proposal)
}

import { H256 } from '@polkadot/types/interfaces'
import { Logger } from 'apps/common/infra/logger/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { EventModel } from 'apps/common/infra/postgresql/models/event.model'
import { TechnicalCommiteeProposalModel } from 'apps/common/infra/postgresql/models/technicalCommittee.model'

// todo not implemented
export const processTechnicalCommitteeMemberExecutedEvent = async (
  event: EventModel,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'process technical commitee member executed event')

  const eventData = event.event.data

  const hash = (<H256>eventData[0]).toString()
  // const techCommProposal = await governanceRepository.technicalCommittee.findProposalByHash(hash)
  // if (!techCommProposal) throw Error('no tech com proposal found for tect comm member executed event ' + event.event_id)

  const result = eventData[0] ? 'Ok' : 'Not ok'

  const proposal: TechnicalCommiteeProposalModel = {
    hash,
    id: null, //todo techCommProposal.id,
    block_id: event.block_id,
    extrinsic_id: '',
    event_id: event.id,
    event: 'MemberExecuted',
    data: { result },
  }

  await governanceRepository.technicalCommittee.save(proposal)
}

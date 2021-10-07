import { GovernanceRepository } from '../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { EventEntry } from '@modules/governance-processor/types'
import { Logger } from 'apps/common/infra/logger/logger'
import { TechnicalCommiteeProposalModel } from 'apps/common/infra/postgresql/governance/models/technicalCommittee.model'

export const processTechnicalCommitteeMemberExecutedEvent = async (
  event: EventModel,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'process technical commitee member executed event')

  const eventData = JSON.parse(event.data)

  const hash = eventData[0]['Hash']
  // const techCommProposal = await governanceRepository.technicalCommittee.findProposalByHash(hash)
  // if (!techCommProposal) throw Error('no tech com proposal found for tect comm member executed event ' + event.event_id)

  const result = eventData[0]['bool'] ? 'Ok' : 'Not ok'

  const proposal: TechnicalCommiteeProposalModel = {
    hash,
    id: null, //todo techCommProposal.id,
    block_id: event.block_id,
    extrinsic_id: '',
    event_id: event.event_id,
    event: 'MemberExecuted',
    data: { result },
  }

  await governanceRepository.technicalCommittee.save(proposal)
}

import { GovernanceRepository } from '../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { EventEntry } from '@modules/governance/types'
import { Logger } from 'apps/common/infra/logger/logger'
import { TechnicalCommiteeProposalModel } from 'apps/common/infra/postgresql/governance/models/technicalCommiteeModel'

export const processTechnicalCommitteeExecutedEvent = async (
  event: EventEntry,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'process technical commitee executed event')

  const eventData = JSON.parse(event.data)

  const hash = eventData[0]['Hash']
  // const techCommProposal = await governanceRepository.technicalCommittee.findProposalByHash(hash)
  // if (!techCommProposal) logger.error('no tech com proposal found for tech comm executed  event ' + event.event_id)

  const result = eventData[1]['DispatchResult']
  const proposal: TechnicalCommiteeProposalModel = {
    hash,
    id: null, // todo techCommProposal?.id ?? null,
    block_id: event.block_id,
    event_id: event.event_id,
    extrinsic_id: '',
    event: 'Executed',
    data: { result },
  }

  await governanceRepository.technicalCommittee.save(proposal)
}

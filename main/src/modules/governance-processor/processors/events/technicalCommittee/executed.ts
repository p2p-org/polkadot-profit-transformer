import { H256 } from '@polkadot/types/interfaces'
import { Logger } from 'loaders/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { EventModel } from '@/models/event.model'
import { TechnicalCommiteeProposalModel } from '@/models/technicalCommittee.model'

export const processTechnicalCommitteeExecutedEvent = async (
  event: EventModel,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'process technical commitee executed event')

  const eventData = event.event.data

  console.log('executed event data', eventData)

  const hash = (<H256>eventData[0]).toString()
  // const techCommProposal = await governanceRepository.technicalCommittee.findProposalByHash(hash)
  // if (!techCommProposal) logger.error('no tech com proposal found for tech comm executed  event ' + event.event_id)

  const result = eventData[1] ?? eventData[1] ?? null

  const proposal: TechnicalCommiteeProposalModel = {
    hash,
    id: null, // todo techCommProposal?.id ?? null,
    block_id: event.block_id,
    event_id: event.id,
    extrinsic_id: '',
    event: 'Executed',
    data: { result },
  }

  await governanceRepository.technicalCommittee.save(proposal)
}

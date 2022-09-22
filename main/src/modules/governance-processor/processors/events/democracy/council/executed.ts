import { H256 } from '@polkadot/types/interfaces'
import { Logger } from 'loaders/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { CouncilProposalModel } from '@/models/councilMotions.model'
import { EventModel } from '@/models/event.model'

export const processCouncilExecutedEvent = async (
  event: EventModel,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'process council executed event')

  const eventData = event.event.data

  const hash = (<H256>eventData[0]).toString()
  try {
    const proposal_id = await governanceRepository.council.findProposalIdByHash(hash)
    const proposal: CouncilProposalModel = {
      hash,
      id: proposal_id,
      block_id: event.block_id,
      event_id: event.id,
      extrinsic_id: '',
      event: 'Executed',
      data: {},
    }

    await governanceRepository.council.save(proposal)
  } catch (error: any) {
    console.error('processCouncilExecutedEvent findProposalIdByHash error:', error.message)
  }
}

import { AccountId32, H256 } from '@polkadot/types/interfaces'
import { Logger } from 'loaders/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { EventModel } from '@/models/event.model'
import { TipsModel } from '@/models/tips.model'

export const processTipsClosedEvent = async (
  event: EventModel,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'process treasury rejected event')

  const eventData = event.event.data

  const hash = (<H256>eventData[0]).toString()
  const accountId = (<AccountId32>eventData[1]).toString()
  const balance = parseInt(eventData[2], 16)

  const tipModel: TipsModel = {
    hash,
    block_id: event.block_id,
    event_id: event.id,
    extrinsic_id: '',
    event: 'TipClosed',
    data: { balance, accountId },
  }

  await governanceRepository.tips.save(tipModel)
}

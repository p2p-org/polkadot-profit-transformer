import { Logger } from 'apps/common/infra/logger/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { EventModel } from 'apps/common/infra/postgresql/models/event.model'
import { TipsModel } from 'apps/common/infra/postgresql/models/tips.model'

export const processTipsClosedEvent = async (
  event: EventModel,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  logger.trace({ event }, 'process treasury rejected event')

  const eventData = JSON.parse(event.data)

  const hash = eventData[0]['Hash']
  const accountId = eventData[1]['AccountId']
  const balance = parseInt(eventData[2]['Balance'], 16)

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

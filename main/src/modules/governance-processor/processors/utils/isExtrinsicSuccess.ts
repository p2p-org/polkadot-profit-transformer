import { Vec } from '@polkadot/types'
import { EventRecord } from '@polkadot/types/interfaces'
import { PolkadotRepository } from 'apps/common/infra/polkadotapi/polkadot.repository'

export const isExtrinsicSuccess = async (
  index: number,
  blockEvents: Vec<EventRecord>,
  polkadotRepository: PolkadotRepository,
): Promise<boolean> => {
  const extrinsicIndex = index

  const events = blockEvents.filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(extrinsicIndex))

  const isSuccess = async (events: EventRecord[]): Promise<boolean> => {
    for (const event of events) {
      const success = await polkadotRepository.isExtrinsicSuccess(event)
      if (success) return true
    }
    return false
  }

  const success = await isSuccess(events)

  return success
}

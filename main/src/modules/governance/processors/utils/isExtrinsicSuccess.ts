import { Extrinsic } from '@modules/governance/types'
import { ApiPromise } from '@polkadot/api'
import { Vec } from '@polkadot/types'
import { EventRecord } from '@polkadot/types/interfaces'

export const isExtrinsicSuccess = async (
  extrinsic: Extrinsic,
  blockEvents: Vec<EventRecord>,
  polkadotApi: ApiPromise,
): Promise<boolean> => {
  const extrinsicIndex = +extrinsic.id.split('-')[1]

  const events = blockEvents.filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(extrinsicIndex))

  const isExtrinsicSuccess = async (events: EventRecord[]): Promise<boolean> => {
    for (const event of events) {
      const success = await polkadotApi.events.system.ExtrinsicSuccess.is(event.event)
      if (success) return true
    }
    return false
  }

  const success = await isExtrinsicSuccess(events)

  return success
}

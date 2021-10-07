import { EventRecord } from '@polkadot/types/interfaces'

export const findEvent = (events: EventRecord[], section: string, method: string): EventRecord | undefined => {
  return events.find((e) => e.event.section === section && e.event.method == method) ?? undefined
}

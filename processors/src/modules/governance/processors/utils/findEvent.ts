import { EventRecord } from '@polkadot/types/interfaces'

export const findEvent = (events: EventRecord[], section: string, method: string): EventRecord | undefined => {
  return events.find((event) => {
    return event.event.section === section && event.event.method === method
  })
}

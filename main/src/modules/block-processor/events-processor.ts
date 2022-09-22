import { EventModel } from '@/models/event.model'
import { Vec } from '@polkadot/types'
import { EventRecord } from '@polkadot/types/interfaces'
// import { Codec } from '@polkadot/types/types'

export const processEvents = (blockId: number, events: Vec<EventRecord>) => {
  const processEvent = (acc: EventModel[], record: EventRecord, eventIndex: number): Array<EventModel> => {
    const { event } = record

    // const types = event.typeDef

    // const extractEventData = (eventDataRaw: any[]): { [x: string]: Codec }[] =>
    //  eventDataRaw.map((data: any, index: number) => ({ [types[index].type]: data }))

    // const eventData = extractEventData(event.data)
    // console.log({ eventData })
    acc.push({
      id: `${blockId}-${eventIndex}`,
      block_id: blockId,
      section: event.section,
      method: event.method,
      // data: eventData,
      event: event,
    })

    return acc
  }
  return events.reduce(processEvent, [])
}

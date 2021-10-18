import { EventModel } from './../../apps/common/infra/postgresql/models/event.model'
import { Vec } from '@polkadot/types'
import { EventRecord, SessionIndex } from '@polkadot/types/interfaces'
import { Logger } from 'apps/common/infra/logger/logger'
import { Codec } from '@polkadot/types/types'

export type EventsProcessor = ReturnType<typeof EventsProcessor>

export const EventsProcessor = (deps: { logger: Logger }) => {
  const { logger } = deps

  return (blockId: number, events: Vec<EventRecord>) => {
    const processEvent = (acc: EventModel[], record: EventRecord, eventIndex: number): Array<EventModel> => {
      const { event } = record

      const types = event.typeDef

      const extractEventData = (eventDataRaw: any[]): { [x: string]: Codec }[] =>
        eventDataRaw.map((data: any, index: number) => ({ [types[index].type]: data }))

      const eventData = extractEventData(event.data)
      // console.log({ eventData })
      acc.push({
        id: `${blockId}-${eventIndex}`,
        block_id: blockId,
        session_id: 0,
        era: 0,
        section: event.section,
        method: event.method,
        data: eventData,
        event: event,
      })

      return acc
    }
    return events.reduce(processEvent, [])
  }
}

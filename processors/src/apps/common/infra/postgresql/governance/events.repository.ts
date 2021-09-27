import { Knex } from 'knex'
import { Logger } from '../../logger/logger'
import { EventModel } from './models/eventModel'

export type EventsRepository = ReturnType<typeof EventsRepository>

export const EventsRepository = (deps: { knex: Knex; logger: Logger }) => {
  const { knex, logger } = deps
  return {
    findBySectionAndMethod: async (method: string, section: string): Promise<EventModel[]> => {
      const events = await EventModel(knex).where({ section, method })
      return events
    },
  }
}

import { Knex } from 'knex'
import { Logger } from '../../logger/logger'
import { EventModel } from './models/eventModel'

export type EventsRepository = ReturnType<typeof EventsRepository>

export const EventsRepository = (deps: { knex: Knex; logger: Logger }) => {
  const { knex, logger } = deps
  return {
    findBySectionAndMethod: async (args: { section: string; method: string }[]): Promise<EventModel[]> => {
      let query = EventModel(knex).withSchema('dot_kusama')
      for (const { method, section } of args) {
        query = query.orWhere({ section, method })
      }
      const events = await query
      return events
    },
  }
}

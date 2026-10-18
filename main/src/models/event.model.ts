import { environment } from '@/environment'
import { Knex } from 'knex'

export type EventModel = {
  event_id: string
  block_id: number
  section: string
  method: string
  // data: any
  event: any
  row_id?: number
  row_time?: Date
}

export const eventsTableName = `${environment.PG_TABLE_PREFIX}${environment.PG_RAW_TABLE_PREFIX}events`
export const EventModel = (knex: Knex) => knex<EventModel>(eventsTableName)

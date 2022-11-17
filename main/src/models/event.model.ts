import { Knex } from 'knex'

export type EventModel = {
  event_id: string
  block_id: number
  section: string
  method: string
  // data: any
  event: any
}

export const EventModel = (knex: Knex) => knex<EventModel>('events')

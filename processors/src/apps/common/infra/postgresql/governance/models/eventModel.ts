import { Knex } from 'knex'

export type EventModel = {
  id: string
  block_id: number
  session_id: number
  era: number
  section: string
  method: string
  data: any
  event: any
}

export const EventModel = (knex: Knex) => knex<EventModel>('events')

import { environment } from '@/environment'
import { Knex } from 'knex'

export type TipsModel = {
  hash: string
  block_id: number
  event_id: string
  extrinsic_id: string
  event: string
  data: any
}

export const TipsModel = (knex: Knex) => knex<TipsModel>(`${environment.PG_TABLE_PREFIX}tips`)

import { environment } from '@/environment'
import { Knex } from 'knex'

export type NominationPoolsEraModel = {
  network_id?: number
  pool_id?: number
  era_id?: number
  state?: string
  members?: number
  points?: number
  reward_pool?: any
  sub_pool_storage?: any
  row_id?: number
  row_time?: Date
}

export const NominationPoolsEraModel = (knex: Knex) =>
  knex<NominationPoolsEraModel>(`${environment.PG_TABLE_PREFIX}nomination_pools_era`)

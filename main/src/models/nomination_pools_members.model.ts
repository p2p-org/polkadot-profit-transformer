import { environment } from '@/environment'
import { Knex } from 'knex'

export type NominationPoolsMembersModel = {
  network_id?: number
  pool_id?: number
  era_id?: number
  account_id?: string
  points?: number
  last_recorded_reward_counter: string
  pending_rewards: number
  unbonding_eras?: any
  row_id?: number
  row_time?: Date
}

export const NominationPoolsMembersModel = (knex: Knex) =>
  knex<NominationPoolsMembersModel>(`${environment.PG_TABLE_PREFIX}nomination_pools_members`)

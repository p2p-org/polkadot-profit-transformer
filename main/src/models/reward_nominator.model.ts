import { environment } from '@/environment'
import { Knex } from 'knex'

export type RewardNominatorModel = {
  era_id: number
  account_id: string
  validator: string
  is_clipped: boolean
  reward_dest?: string
  reward_account_id?: string
  row_time?: Date
}

export const RewardNominatorModel = (knex: Knex) => knex<RewardNominatorModel>(`${environment.PG_TABLE_PREFIX}rewards_nominators`)

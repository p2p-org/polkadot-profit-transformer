import { environment } from '@/environment';
import { Knex } from 'knex'

export type RewardEraModel = {
  era_id: number
  payout_block_id: number
  total_reward: string
  total_reward_points: number
  row_time?: Date
}

export const RewardEraModel = (knex: Knex) => knex<RewardEraModel>(`${environment.PG_TABLE_PREFIX}rewards_eras`)

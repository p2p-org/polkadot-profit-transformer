import { environment } from '@/environment';
import { Knex } from 'knex'

export type RewardCollatorModel = {
  round_id: number
  account_id: string
  final_stake: bigint
  // delegators_count: number
  total_reward_points: number
  total_reward?: bigint
  collator_reward?: bigint
  payout_block_id?: number
  payout_block_time?: Date
  row_time?: Date
}

export const RewardCollatorModel = (knex: Knex) => knex<RewardCollatorModel>(`${environment.PG_TABLE_PREFIX}rewards_collators`)

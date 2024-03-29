import { Knex } from 'knex'

export type CollatorModel = {
  round_id: number
  account_id: string
  total_stake: bigint
  final_stake: bigint
  own_stake: bigint
  delegators_count: number
  total_reward_points: number
  total_reward?: bigint
  collator_reward?: bigint
  payout_block_id?: number
  payout_block_time?: Date
  row_time?: Date
}

export const CollatorModel = (knex: Knex) => knex<CollatorModel>('collators')

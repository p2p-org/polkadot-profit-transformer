import { Knex } from 'knex'

export type RoundStakeModel = {
  round_id: number
  payout_block_id: number
  payout_block_time?: Date
  start_block_id: number
  start_block_time?: Date
  total_reward: string
  total_stake: string
  total_reward_points: number
  collators_count: number
  runtime: number
  row_time?: Date
}

export const RoundStakeModel = (knex: Knex) => knex<RoundStakeModel>('rounds_stake')

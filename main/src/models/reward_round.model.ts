import { Knex } from 'knex'

export type RewardRoundModel = {
  round_id: number
  payout_block_id: number
  payout_block_time?: Date
  total_reward: string
  total_reward_points: number
  collators_count: number
  runtime: number
  row_time?: Date
}

export const RewardRoundModel = (knex: Knex) => knex<RewardRoundModel>('rewards_rounds')

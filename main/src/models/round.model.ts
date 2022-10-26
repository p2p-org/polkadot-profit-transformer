import { Knex } from 'knex'

export type RoundModel = {
  round_id: number;
  payout_block_id: number;
  payout_block_time?: Date;
  start_block_id: number;
  start_block_time?: Date;
  total_reward: string;
  total_stake: string;
  total_reward_points: number;
  collators_count: number;
  runtime: number;
}

export const RoundModel = (knex: Knex) => knex<RoundModel>('rounds')

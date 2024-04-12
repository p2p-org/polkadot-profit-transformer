import { Knex } from 'knex'

export type StakeRoundModel = {
  round_id: number
  start_block_id: number
  start_block_time?: Date
  total_stake: bigint
  collators_count: number
  runtime: number
  row_time?: Date
}

export const StakeRoundModel = (knex: Knex) => knex<StakeRoundModel>('stake_rounds')

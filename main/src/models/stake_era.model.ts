import { Knex } from 'knex'

export type StakeEraModel = {
  era_id: number
  session_start: number
  start_block_id: number
  start_block_time?: Date
  total_stake: string
  row_time?: Date
}

export const StakeEraModel = (knex: Knex) => knex<StakeEraModel>('stake_eras')

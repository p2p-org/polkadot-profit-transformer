import { Knex } from 'knex'

export type StakeEraModel = {
  era_id: number
  session_start: number
  total_stake: string
  row_time?: Date
}

export const StakeEraModel = (knex: Knex) => knex<StakeEraModel>('stake_eras')

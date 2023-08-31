import { Knex } from 'knex'

export type StakeCollatorModel = {
  round_id: number
  account_id: string
  total_stake: bigint
  own_stake: bigint
  delegators_count: number
  row_time?: Date
}

export const StakeCollatorModel = (knex: Knex) => knex<StakeCollatorModel>('stake_collators')

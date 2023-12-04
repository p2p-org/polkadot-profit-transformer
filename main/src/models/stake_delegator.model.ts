import { Knex } from 'knex'

export type StakeDelegatorModel = {
  round_id: number
  account_id: string
  collator_id: string
  amount: string
  row_time?: Date
}

export const StakeDelegatorModel = (knex: Knex) => knex<StakeDelegatorModel>('stake_delegators')

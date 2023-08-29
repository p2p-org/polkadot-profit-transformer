import { Knex } from 'knex'

export type StakeNominatorModel = {
  era_id: number
  account_id: string
  validator: string
  is_clipped: boolean
  value: string
  row_time?: Date
}

export const StakeNominatorModel = (knex: Knex) => knex<StakeNominatorModel>('stake_nominators')

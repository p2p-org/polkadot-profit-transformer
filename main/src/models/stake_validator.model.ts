import { Knex } from 'knex'

export type StakeValidatorModel = {
  era_id: number
  account_id: string
  total: string
  own: string
  nominators_count: number
  prefs: any
  row_time?: Date
}

export const StakeValidatorModel = (knex: Knex) => knex<StakeValidatorModel>('stake_validators')

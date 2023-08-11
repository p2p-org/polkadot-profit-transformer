import { Knex } from 'knex'

export type ValidatorStakeModel = {
  era_id: number
  account_id: string
  total: string
  own: string
  nominators_count: number
  reward_points?: number
  reward_dest?: string
  reward_account_id?: string
  prefs: any
  block_time: Date
  row_time?: Date
}

export const ValidatorStakeModel = (knex: Knex) => knex<ValidatorStakeModel>('validators_stake')

import { Knex } from 'knex'

export type RewardValidatorModel = {
  era_id: number
  account_id: string
  nominators_count: number
  reward_points?: number
  reward_dest?: string
  reward_account_id?: string
  //prefs: any
  row_time?: Date
}

export const RewardValidatorModel = (knex: Knex) => knex<RewardValidatorModel>('rewards_validators')

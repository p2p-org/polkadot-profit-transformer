import { Knex } from 'knex'

export type NominatorStakeModel = {
  era_id: number
  account_id: string
  validator: string
  is_clipped: boolean
  value: string
  reward_dest?: string
  reward_account_id?: string
  block_time: Date
  row_time?: Date
}

export const NominatorStakeModel = (knex: Knex) => knex<NominatorStakeModel>('nominators_stake')

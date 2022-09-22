import { Knex } from 'knex'

export type NominatorModel = {
  era: number
  account_id: string
  validator: string
  is_clipped: boolean
  value: string
  reward_dest?: string
  reward_account_id?: string
  block_time: Date
}

export const NominatorModel = (knex: Knex) => knex<NominatorModel>('nominators')

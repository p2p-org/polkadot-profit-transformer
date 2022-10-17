import { Knex } from 'knex'

export type CollatorModel = {
  round_id: number
  account_id: string
  total_stake: string
  own_stake: string
  delegators_count: number
  reward_points: number
  reward?: string
  payout_block_id: number
  payout_block_time?: Date
}

export const CollatorModel = (knex: Knex) => knex<CollatorModel>('collators')

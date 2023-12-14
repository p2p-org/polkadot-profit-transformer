import { Knex } from 'knex'

export type RewardDelegatorModel = {
  round_id: number
  account_id: string
  collator_id: string
  reward: string
  final_amount: string
  payout_block_id?: number
  payout_block_time?: Date
  row_time?: Date
}

export const RewardDelegatorModel = (knex: Knex) => knex<RewardDelegatorModel>('rewards_delegators')

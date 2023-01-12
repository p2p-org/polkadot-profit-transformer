import { Knex } from 'knex'

export type DelegatorModel = {
  round_id: number
  account_id: string
  collator_id: string
  amount: string
  final_amount: string
  reward: string
  payout_block_id?: number
  payout_block_time?: Date
  row_time?: Date
}

export const DelegatorModel = (knex: Knex) => knex<DelegatorModel>('delegators')

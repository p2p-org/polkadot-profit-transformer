import { Knex } from 'knex'

export type BalancesModel = {
  block_id: number
  account_id?: string
  blake2_hash: string
  nonce: number;
  consumers: number
  providers: number
  sufficients: number
  free: bigint
  reserved: bigint
  miscFrozen: bigint
  feeFrozen: bigint
  row_id?: number
  row_time?: Date
}

export const BalancesModel = (knex: Knex) => knex<BalancesModel>('balances')

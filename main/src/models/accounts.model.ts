import { Knex } from 'knex'

export type AccountModel = {
  account_id: string
  blake2_hash?: string
  created_at_block_id?: number
  killed_at_block_id?: number
  judgement_status?: string
  registrar_index?: number
  row_id?: number
  row_time?: Date
  is_modified?: number
}

export const AccountModel = (knex: Knex) => knex<AccountModel>('accounts')

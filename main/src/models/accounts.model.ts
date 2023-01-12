import { Knex } from 'knex'

export type AccountModel = {
  account_id: string
  created_at_block_id?: number
  killed_at_block_id?: number
  judgement_status?: string
  registrar_index?: number
  row_id?: number
  row_time?: Date
}

export const AccountModel = (knex: Knex) => knex<AccountModel>('accounts')

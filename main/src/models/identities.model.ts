import { Knex } from 'knex'

export type IdentityModel = {
  account_id: string
  parent_account_id?: string | null
  display?: string
  legal?: string
  web?: string
  riot?: string
  email?: string
  twitter?: string
  updated_at_block_id?: number
  row_id?: number
  row_time?: Date
}

export const IdentityModel = (knex: Knex) => knex<IdentityModel>('identities')

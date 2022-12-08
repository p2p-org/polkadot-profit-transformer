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
  judgement_status?: string
  registrar_index?: string
  created_at_block_id?: number
  killed_at_block_id?: number
}

export const IdentityModel = (knex: Knex) => knex<IdentityModel>('identity')

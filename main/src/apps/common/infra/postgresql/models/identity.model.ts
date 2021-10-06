import { Knex } from 'knex'

export type IdentityModel = {
  account_id: string
  root_acccount_id?: string
  display?: string
  legal?: string
  web?: string
  riot?: string
  email?: string
  twitter?: string
  judgement_status?: string
  registrar_index?: string
  created_at?: number
  killed_at?: number
}

export const IdentityModel = (knex: Knex) => knex<IdentityModel>('account_identity')

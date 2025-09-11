import { environment } from '@/environment'
import { Knex } from 'knex'

export type NominationPoolsIdentitiesModel = {
  network_id?: number
  pool_id?: number
  pool_name?: string
  depositor_id?: string
  root_id?: string
  nominator_id?: string
  toggler_id?: string
  reward_id?: string
  stash_id?: string
  row_id?: number
  commission?: any
  row_time?: Date
}

export const NominationPoolsIdentitiesModel = (knex: Knex) =>
  knex<NominationPoolsIdentitiesModel>(`${environment.PG_TABLE_PREFIX}nomination_pools_identities`)

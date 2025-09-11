import { environment } from '@/environment'
import { Knex } from 'knex'

export type NetworkModel = {
  id?: number
  name: string
}

export const NetworkModel = (knex: Knex) => knex<NetworkModel>(`${environment.PG_TABLE_PREFIX}networks`)

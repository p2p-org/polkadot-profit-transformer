import { environment } from '@/environment'
import { Knex } from 'knex'

export type TotalIssuance = {
  block_id: number
  total_issuance: string
  row_time?: Date
  row_id?: number
}

export const totalIssuanceTableName = `${environment.PG_TABLE_PREFIX}total_issuance`
export const TotalIssuance = (knex: Knex) => knex<TotalIssuance>(totalIssuanceTableName)

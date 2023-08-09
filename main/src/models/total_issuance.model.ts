import { Knex } from 'knex'

export type TotalIssuance = {
  block_id: number
  total_issuance: string
  row_time?: Date
  row_id?: number
}

export const TotalIssuance = (knex: Knex) => knex<TotalIssuance>('total_issuance')

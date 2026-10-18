import { environment } from '@/environment'
import { Knex } from 'knex'

export type SliMetricsModel = {
  entity: string
  entity_id?: number
  name: string
  value?: number
  row_id?: number
  row_time?: Date
}

export const SliMetricsModel = (knex: Knex) => knex<SliMetricsModel>(`${environment.PG_TABLE_PREFIX}sli_metrics`)

import { environment } from '@/environment'
import { Knex } from 'knex'

export enum ENTITY {
  BLOCK = 'block',
  ERA = 'era',
  ROUND = 'round',
}

export type ProcessingStateModel<T> = {
  entity: string
  entity_id: number
  row_id?: number
}

export const ProcessingStateModel = (knex: Knex) =>
  knex<ProcessingStateModel<ENTITY>>(`${environment.PG_TABLE_PREFIX}processing_state`)

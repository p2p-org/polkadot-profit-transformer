import { Knex } from 'knex'

export enum ENTITY {
  BLOCK = 'block',
  ERA = 'era',
}

export type ProcessingStateModel<T> = {
  entity: ENTITY
  entity_id: number
  row_id?: number
}

export const ProcessingStateModel = (knex: Knex) => knex<ProcessingStateModel<ENTITY>>('processing_state')

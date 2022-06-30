import { Knex } from 'knex'

export enum ENTITY {
  BLOCK = 'block',
  ERA = 'era',
}

export enum PROCESSING_STATUS {
  NOT_PROCESSED = 'not_processed',
  PROCESSED = 'processed',
}

export type ProcessingTaskModel = {
  entity: ENTITY
  entity_id: number
  status: PROCESSING_STATUS
  collect_uid: string
  start_timestamp: Date
  finish_timestamp?: Date
  data: any
}

export const ProcessingTaskModel = (knex: Knex) => knex<ProcessingTaskModel>('processing_tasks')

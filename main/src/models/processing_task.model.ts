import { Knex } from 'knex'

export enum ENTITY {
  BLOCK = 'block',
  BLOCK_METADATA = 'block_metadata',
  ERA = 'era',
  ROUND = 'round',
}

export enum PROCESSING_STATUS {
  NOT_PROCESSED = 'not_processed',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  CANCELLED = 'cancelled',
}

export type ProcessingTaskModel<T> = T extends ENTITY.BLOCK
  ? {
    entity: ENTITY
    entity_id: number
    status: PROCESSING_STATUS
    collect_uid: string
    start_timestamp: Date
    finish_timestamp?: Date
    data: any
    attempts: number
    row_id?: number
  } : T extends ENTITY.BLOCK_METADATA ?
  {
    entity: ENTITY
    entity_id: number
    status: PROCESSING_STATUS
    collect_uid: string
    start_timestamp: Date
    finish_timestamp?: Date
    data: any
    attempts: number
    row_id?: number
  }
  : {
    entity: ENTITY
    entity_id: number
    status: PROCESSING_STATUS
    collect_uid: string
    start_timestamp: Date
    finish_timestamp?: Date
    data: {
      payout_block_id: number
    }
    attempts: number
    row_id?: number
  }

export const ProcessingTaskModel = (knex: Knex) => knex<ProcessingTaskModel<ENTITY>>('processing_tasks')

import { Knex } from 'knex'

export enum ENTITY {
  BLOCK = 'block',
  ERA = 'era',
}

export enum PROCESSING_STATUS {
  NOT_PROCESSED = 'not_processed',
  PROCESSED = 'processed',
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
      row_id?: number
    }

export const ProcessingTaskModel = (knex: Knex) => knex<ProcessingTaskModel<ENTITY>>('processing_tasks')

import { environment } from '@apps/main/environment'
import { Knex } from 'knex'
import { logger } from '../logger/logger'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from './models/processing_task.model'

const BATCH_INSERT_CHUNK_SIZE = 1000

export type ProcessingTasksRepository = ReturnType<typeof ProcessingTasksRepository>

const network = { network_id: environment.NETWORK_ID }

export const ProcessingTasksRepository = (deps: { knex: Knex }) => {
  const { knex } = deps

  return {
    findLastEntityId: async (entity: ENTITY): Promise<number> => {
      const lastEntity = await ProcessingTaskModel(knex)
        .where({ entity: entity, ...network })
        .orderBy('row_id', 'desc')
        .first()

      logger.debug({
        event: 'ProcessingTasksRepository findLastEntityId',
        entity,
        lastEntity,
      })
      const lastEntityId = lastEntity ? Number(lastEntity.entity_id) : -1
      logger.debug({ lastEntityId })
      return lastEntityId
    },
    // isEntityExists: async (entity: ENTITY, entity_id: number): Promise<boolean> => {
    //   const record = await ProcessingTaskModel(knex)
    //     .where({ entity, entity_id, ...network })
    //     .first()

    //   logger.debug({
    //     event: 'ProcessingTasksRepository isEntityExists',
    //     entity,
    //     entity_id,
    //     record,
    //   })
    //   return !!record
    // },
    async batchAddEntities(records: ProcessingTaskModel<ENTITY>[]) {
      const insert = records.map((record) => ({ ...record, ...network }))
      await knex.batchInsert('processing_tasks', insert, BATCH_INSERT_CHUNK_SIZE)
    },
    async addProcessingTask(task: ProcessingTaskModel<ENTITY>) {
      await ProcessingTaskModel(knex).insert({ ...task, ...network })
    },
    async readTaskAndLockRow(
      entity: ENTITY,
      entity_id: number,
      trx: Knex.Transaction<any, any[]>,
    ): Promise<ProcessingTaskModel<ENTITY> | undefined> {
      return ProcessingTaskModel(knex)
        .transacting(trx)
        .forUpdate()
        .select()
        .where({ entity, entity_id, ...network })
        .orderBy('row_id', 'desc')
        .limit(1)
        .first()
    },
    async setTaskRecordAsProcessed(record: ProcessingTaskModel<ENTITY>, trx: Knex.Transaction<any, any[]>) {
      await ProcessingTaskModel(knex)
        .transacting(trx)
        .where({ row_id: record.row_id, ...network })
        .update({ status: PROCESSING_STATUS.PROCESSED, finish_timestamp: new Date() })
    },
  }
}

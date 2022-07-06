import { environment } from '@apps/main/environment'
import { Knex } from 'knex'
import { logger } from '../logger/logger'
import { ENTITY, ProcessingTaskModel } from './models/processing_task.model'

const BATCH_INSERT_CHUNK_SIZE = 1000

export type ProcessingTasksRepository = ReturnType<typeof ProcessingTasksRepository>

const network = { network_id: environment.NETWORK_ID }

export const ProcessingTasksRepository = (deps: { knex: Knex }) => {
  const { knex } = deps

  return {
    findLastEntityId: async (entity: ENTITY): Promise<number> => {
      const lastEntity = await ProcessingTaskModel(knex)
        .where({ entity: entity, ...network })
        .orderBy('entity_id', 'desc')
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
    isEntityExists: async (entity: ENTITY, entity_id: number): Promise<boolean> => {
      const record = await ProcessingTaskModel(knex)
        .where({ entity, entity_id, ...network })
        .orderBy('entity_id', 'desc')
        .first()

      logger.debug({
        event: 'ProcessingTasksRepository isEntityExists',
        entity,
        entity_id,
        record,
      })
      return !!record
    },
    async batchAddEntities(records: ProcessingTaskModel[]) {
      const insert = records.map((record) => ({ ...record, ...network }))
      await knex.batchInsert('processing_tasks', insert, BATCH_INSERT_CHUNK_SIZE)
    },
    async addProcessingTask(task: ProcessingTaskModel) {
      await ProcessingTaskModel(knex).insert({ ...task, ...network })
    },
    async readTaskAndLockRow(
      entity: ENTITY,
      entity_id: number,
      trx: Knex.Transaction<any, any[]>,
    ): Promise<ProcessingTaskModel | undefined> {
      return ProcessingTaskModel(knex)
        .transacting(trx)
        .forUpdate()
        .select()
        .where({ entity, entity_id, ...network })
        .orderBy('raw_id', 'desc')
        .first()
    },
  }
}

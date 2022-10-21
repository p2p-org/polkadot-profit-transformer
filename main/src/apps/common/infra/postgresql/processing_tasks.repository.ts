import { Knex } from 'knex'
import { environment } from '@/environment'
import { logger } from '@/loaders/logger'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@/models/processing_task.model'

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
        .limit(1)
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
    async batchAddEntities(records: ProcessingTaskModel<ENTITY>[], trx: Knex.Transaction<any, any[]>) {
      const insert = records.map((record) => ({ ...record, ...network }))
      // await knex.batchInsert('processing_tasks', insert, BATCH_INSERT_CHUNK_SIZE).transacting(trx).returning('entity_id')
      await ProcessingTaskModel(knex).transacting(trx).insert(insert) // .returning('entity_id')
    },

    async addProcessingTask(task: ProcessingTaskModel<ENTITY>) {
      await ProcessingTaskModel(knex).insert({ ...task, ...network })
    },

    async increaseAttempts(entity: ENTITY, entity_id: number) {
      await knex.raw(
        `UPDATE processing_tasks ` +
        `SET attempts = attempts+1 `+ //, status=${PROCESSING_STATUS.PROCESSING}
        `WHERE entity_id = ${entity_id} AND entity='${entity}' AND network_id = ${network.network_id}`,
      )
    },

    async readTaskAndLockRow(
      entity: ENTITY,
      entity_id: number,
      trx: Knex.Transaction<any, any[]>,
    ): Promise<ProcessingTaskModel<ENTITY> | undefined> {

      const tasksRecords = await ProcessingTaskModel(knex)
        .transacting(trx)
        .forUpdate()
        .select()
        .where({ entity, entity_id, ...network, status: PROCESSING_STATUS.NOT_PROCESSED })
        .orderBy('row_id', 'desc')

      if (tasksRecords && tasksRecords.length >= 1) {
        for (let i=1; i<tasksRecords.length; i++) {
          await ProcessingTaskModel(knex)
            .transacting(trx)
            .where({ row_id: tasksRecords[i].row_id, ...network })
            .update({ status: PROCESSING_STATUS.CANCELLED })
        }
        return tasksRecords[0]
      }
    },

    async getUnprocessedTasks(
      entity: ENTITY,
      entity_id?: number
    ): Promise<Array<ProcessingTaskModel<ENTITY>>> {

      const tasksRecords = ProcessingTaskModel(knex)
        .select()
        .where({ entity, ...network, status: PROCESSING_STATUS.NOT_PROCESSED })
        .orderBy('entity_id', 'asc')
        .limit(1000)

      if (entity_id) {
        tasksRecords.andWhere('entity_id', '>', entity_id)
      }

      return await tasksRecords
    },

    async getUnprocessedTask(
      entity: ENTITY,
      entity_id?: number
    ): Promise<ProcessingTaskModel<ENTITY>> {
      const tasksRecord = await ProcessingTaskModel(knex)
        .select()
        .where({ entity, ...network, entity_id, status: PROCESSING_STATUS.NOT_PROCESSED })

      return tasksRecord && tasksRecord[0];
    },

    async setTaskRecordAsProcessed(record: ProcessingTaskModel<ENTITY>, trx: Knex.Transaction<any, any[]>) {
      await ProcessingTaskModel(knex)
        .transacting(trx)
        .where({ row_id: record.row_id, ...network })
        .update({ status: PROCESSING_STATUS.PROCESSED, finish_timestamp: new Date() })
    },
  }
}

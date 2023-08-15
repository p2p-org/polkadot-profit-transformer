import { Inject, Service } from 'typedi'
import { Logger } from 'pino'
import { Knex } from 'knex'
import { environment } from '@/environment'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@/models/processing_task.model'

const network = { network_id: environment.NETWORK_ID }

@Service()
export class TasksRepository {
  constructor(@Inject('logger') private readonly logger: Logger, @Inject('knex') private readonly knex: Knex) { }

  async findLastEntityId(entity: ENTITY): Promise<number> {
    const lastEntity = await ProcessingTaskModel(this.knex)
      .where({ entity: entity, ...network })
      .orderBy('row_id', 'desc')
      .limit(1)
      .first()

    this.logger.debug({
      event: 'ProcessingTasksRepository findLastEntityId',
      entity,
      lastEntity,
    })
    const lastEntityId = lastEntity ? Number(lastEntity.entity_id) : -1
    this.logger.debug({ lastEntityId })
    return lastEntityId
  }

  async batchAddEntities(records: ProcessingTaskModel<ENTITY>[], trx: Knex.Transaction | undefined = undefined): Promise<void> {
    const insert = records.map((record) => ({ ...record, ...network }))
    // await knex.batchInsert('processing_tasks', insert, BATCH_INSERT_CHUNK_SIZE).transacting(trx).returning('entity_id')
    if (trx) {
      await ProcessingTaskModel(this.knex).transacting(trx).insert(insert) // .returning('entity_id')
    } else {
      await ProcessingTaskModel(this.knex).insert(insert) // .returning('entity_id')
    }
  }

  async addProcessingTask(task: ProcessingTaskModel<ENTITY>): Promise<boolean> {
    const existsTask = await ProcessingTaskModel(this.knex)
      .select()
      .where({ entity: task.entity, entity_id: task.entity_id, ...network })
      .first()

    if (existsTask && existsTask.status === PROCESSING_STATUS.NOT_PROCESSED) return true
    if (existsTask) return false

    await ProcessingTaskModel(this.knex).insert({ ...task, ...network })
    return true
  }

  async increaseAttempts(entity: ENTITY, entity_id: number, collect_uid: string): Promise<void> {
    await this.knex.raw(
      `UPDATE processing_tasks ` +
      `SET attempts = attempts+1 ` + //, status=${PROCESSING_STATUS.PROCESSING}
      `WHERE entity_id = ${entity_id} AND entity='${entity}' AND collect_uid='${collect_uid}' AND network_id = ${network.network_id}`,
    )
  }

  async readTaskAndLockRow(
    entity: ENTITY,
    entity_id: number,
    collect_uid: string,
    trx: Knex.Transaction<any, any[]>,
  ): Promise<ProcessingTaskModel<ENTITY> | undefined> {
    const tasksRecords = await ProcessingTaskModel(this.knex)
      .transacting(trx)
      .forUpdate()
      .select()
      .where({ entity, entity_id, ...network /*, status: PROCESSING_STATUS.NOT_PROCESSED*/ })
      .orderBy('row_id', 'desc')

    if (tasksRecords && tasksRecords.length > 1) {
      this.logger.warn({
        event: 'RabbitMQ.readTaskAndLockRow',
        entity,
        entity_id,
        collect_uid,
        error: `Possible ${entity} with id: ${entity_id} processing task duplication. ` + `Found: ${tasksRecords.length} records`,
      })
      return
    }

    if (tasksRecords[0].collect_uid !== collect_uid) {
      this.logger.warn({
        event: 'RabbitMQ.readTaskAndLockRow',
        entity,
        entity_id,
        collect_uid,
        error:
          `Problem with ${entity} with id: ${entity_id}. ` +
          `Expected collect_uid: ${collect_uid}, found: ${tasksRecords[0].collect_uid}`,
      })
      return
    }
    return tasksRecords[0]
    /*
      for (let i = 1; i < tasksRecords.length; i++) {
        await ProcessingTaskModel(this.knex)
          .transacting(trx)
          .where({ row_id: tasksRecords[i].row_id, ...network })
          .update({ status: PROCESSING_STATUS.CANCELLED })
      }
      return tasksRecords[0]
    }
    */
  }

  async getUnprocessedTasks(entity: ENTITY, entity_id?: number): Promise<Array<ProcessingTaskModel<ENTITY>>> {
    const tasksRecords = ProcessingTaskModel(this.knex)
      .select()
      .where({ entity, ...network, status: PROCESSING_STATUS.NOT_PROCESSED })
      .orderBy('entity_id', 'asc')
      .limit(environment.BATCH_INSERT_CHUNK_SIZE)

    if (entity_id) {
      tasksRecords.andWhere('entity_id', '>', entity_id)
    }

    return await tasksRecords
  }

  async getUnprocessedTask(entity: ENTITY, entity_id?: number): Promise<ProcessingTaskModel<ENTITY>> {
    console.log(entity, entity_id)
    const tasksRecord = await ProcessingTaskModel(this.knex)
      .select()
      .where({ entity, ...network, entity_id, status: PROCESSING_STATUS.NOT_PROCESSED })

    return tasksRecord && tasksRecord[0]
  }

  async setTaskRecordAsProcessed(trx: Knex.Transaction<any, any[]>, record: ProcessingTaskModel<ENTITY>): Promise<void> {
    await ProcessingTaskModel(this.knex)
      .transacting(trx)
      .where({ row_id: record.row_id, ...network })
      .update({ status: PROCESSING_STATUS.PROCESSED, finish_timestamp: new Date() })
  }
}

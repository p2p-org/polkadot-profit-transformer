import { Inject, Service } from 'typedi'
import { Logger } from 'pino'
import { Knex } from 'knex'
import { environment } from '@/environment'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@/models/processing_task.model'
import { ProcessingStateModel } from '@/models/processing_status.model'

const network = { network_id: environment.NETWORK_ID }

@Service()
export class DatabaseHelper {
  private _knex: Knex
  constructor(knex: Knex) {
    this._knex = knex
  }

  public async findLastEntityId(entity: ENTITY): Promise<number> {
    const lastEntity = await ProcessingStateModel(this._knex)
      .where({ entity, ...network })
      .orderBy('row_id', 'desc')
      .limit(1)
      .first()

    const lastEntityId = lastEntity ? Number(lastEntity.entity_id) : -1
    return lastEntityId
  }

  public async updateLastTaskEntityId(status: ProcessingStateModel<ENTITY>): Promise<void> {
    await ProcessingStateModel(this._knex)
      .insert({ ...status, ...network })
      .onConflict(['entity', 'network_id'])
      .merge()
  }
}

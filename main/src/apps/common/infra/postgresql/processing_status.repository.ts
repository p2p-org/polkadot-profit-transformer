import { Knex } from 'knex'
import { logger } from '@/loaders/logger'
import { environment } from '@/apps/main/environment'
import { ENTITY, ProcessingStateModel } from './models/processing_status.model'

export type ProcessingStatusRepository = ReturnType<typeof ProcessingStatusRepository>

const network = { network_id: environment.NETWORK_ID }

export const ProcessingStatusRepository = (deps: { knex: Knex }) => {
  const { knex } = deps

  return {
    findLastEntityId: async (entity: ENTITY): Promise<number> => {
      const lastEntity = await ProcessingStateModel(knex)
        .where({ entity: entity, ...network })
        .orderBy('row_id', 'desc')
        .limit(1)
        .first()

      logger.debug({
        event: 'ProcessingStatusRepository findLastEntityId',
        entity,
        lastEntity,
      })
      const lastEntityId = lastEntity ? Number(lastEntity.entity_id) : -1
      logger.debug({ lastEntityId })
      return lastEntityId
    },
    async updateLastTaskEntityId(status: ProcessingStateModel<ENTITY>, trx: Knex.Transaction<any, any[]>) {
      await ProcessingStateModel(knex)
        .transacting(trx)
        .insert({ ...status, ...network })
        .onConflict(['entity', 'network_id'])
        .merge()
    },
  }
}

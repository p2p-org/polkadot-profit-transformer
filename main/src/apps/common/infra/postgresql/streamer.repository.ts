import { Knex } from 'knex'
import { environment } from '@apps/main/environment'
import { logger } from '../logger/logger'

import { ExtrinsicModel } from './models/extrinsic.model'
import { BlockModel } from './models/block.model'
import { EventModel } from './models/event.model'

const network = { network_id: environment.NETWORK_ID }

export type StreamerRepository = ReturnType<typeof StreamerRepository>

export const StreamerRepository = (deps: { knex: Knex }) => (trx: Knex.Transaction<any, any[]>) => {
  const { knex } = deps

  return {
    blocks: {
      save: async (block: BlockModel): Promise<void> => {
        await BlockModel(knex)
          .transacting(trx)
          .insert({ ...block, ...network })
      },
      // findLastBlockId: async (): Promise<number | undefined> => {
      //   const lastBlock = await BlockModel(knex).where(network).orderBy('id', 'desc').first()
      //   const lastBlockId = lastBlock ? Number(lastBlock.id) : 0
      //   return lastBlockId
      // },
    },
    events: {
      save: async (event: EventModel): Promise<void> => {
        const eventForDb = { ...event, data: JSON.stringify(event.data), event: event.event.toJSON() }
        await EventModel(knex)
          .transacting(trx)
          .insert({ ...eventForDb, ...network })
      },
      // findEraPayoutEvent: async (args: { eraId: number }): Promise<EventModel | undefined> => {
      //   const { eraId } = args
      //   logger.debug({ findEraPayoutEvent: { eraId } })
      //   const event = await EventModel(knex)
      //     .where(function () {
      //       this.where({
      //         section: 'staking',
      //         method: 'EraPaid',
      //         ...network,
      //       }).orWhere({
      //         section: 'staking',
      //         method: 'EraPayout',
      //         ...network,
      //       })
      //     })
      //     .andWhereRaw(`event -> 'data' -> 0 = '${eraId}'`)
      //     .first()

      //   return event
      // },
    },
    extrinsics: {
      save: async (extrinsic: ExtrinsicModel): Promise<void> => {
        const strigifiedDataExtrinsic = {
          ...extrinsic,
          extrinsic: JSON.stringify(extrinsic.extrinsic),
          args: JSON.stringify(extrinsic.args),
        }
        await ExtrinsicModel(knex)
          .transacting(trx)
          .insert({ ...strigifiedDataExtrinsic, ...network })
      },
    },
  }
}

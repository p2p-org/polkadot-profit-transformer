import { Knex } from 'knex'

import { ExtrinsicModel } from './models/extrinsic.model'
import { BlockModel } from './models/block.model'
import { EventModel } from './models/event.model'
import { Logger } from '../logger/logger'

export type StreamerRepository = ReturnType<typeof StreamerRepository>

export const StreamerRepository = (deps: { knex: Knex; logger: Logger; networkId: number }) => {
  const { knex, logger, networkId } = deps
  const network = { network_id: networkId }
  return {
    blocks: {
      save: async (block: BlockModel): Promise<void> => {
        await BlockModel(knex)
          .insert({ ...block, ...network })
          .onConflict(['id', 'network_id'])
          .merge()
      },
      findLastBlockId: async (): Promise<number | undefined> => {
        const lastBlock = await BlockModel(knex).where(network).orderBy('id', 'desc').first()
        const lastBlockId = lastBlock ? Number(lastBlock.id) : 0
        return lastBlockId
      },
      async getFirstBlockInEra(eraId: number): Promise<BlockModel | undefined> {
        const firstBlock = await BlockModel(knex)
          .where({ era: eraId, ...network })
          .orderBy('id')
          .first()
        return firstBlock
      },
    },
    events: {
      save: async (event: EventModel): Promise<void> => {
        const stringifiedDataEvent = { ...event, data: JSON.stringify(event.data) }
        await EventModel(knex)
          .insert({ ...stringifiedDataEvent, ...network })
          .onConflict(['id', 'network_id'])
          .merge()
      },
      findBySectionAndMethod: async (args: { section: string; method: string }[]): Promise<EventModel[]> => {
        // todo implement schema from env
        let query = EventModel(knex).withSchema('dot_polka')
        for (const { method, section } of args) {
          query = query.orWhere({ section, method })
        }
        const events = await query
        return events
      },
    },
    extrinsics: {
      save: async (extrinsic: ExtrinsicModel): Promise<void> => {
        const strigifiedDataExtrinsic = {
          ...extrinsic,
          extrinsic: JSON.stringify(extrinsic.extrinsic),
          args: JSON.stringify(extrinsic.args),
        }
        await ExtrinsicModel(knex)
          .insert({ ...strigifiedDataExtrinsic, ...network })
          .onConflict(['id', 'network_id'])
          .merge()
      },
      findBySectionAndMethod: async (args: { section: string; method: string }[]): Promise<ExtrinsicModel[]> => {
        // todo implement schema from env
        let query = ExtrinsicModel(knex).withSchema('mbelt')
        for (const { method, section } of args) {
          query = query.orWhere({ section, method })
        }
        const extrinsics = await query
        return extrinsics
      },
    },
  }
}

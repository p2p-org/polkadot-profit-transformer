import { Knex } from 'knex'

import { EraModel } from './models/era.model'
import { ExtrinsicModel } from './models/extrinsic.model'
import { BlockModel } from './models/block.model'
import { EventModel } from './models/event.model'
import { Logger } from '../logger/logger'

export type StreamerRepository = ReturnType<typeof StreamerRepository>

export const StreamerRepository = (deps: { knex: Knex; logger: Logger }) => {
  const { knex, logger } = deps
  return {
    blocks: {
      save: async (block: BlockModel): Promise<void> => {
        await BlockModel(knex).insert(block).onConflict(['id']).merge()
      },
      findLastBlockId: async (): Promise<number | undefined> => {
        const lastBlock = await BlockModel(knex).where(true).orderBy('id', 'desc').first()
        const lastBlockId = lastBlock ? Number(lastBlock.id) : 0
        return lastBlockId
      },
      async getFirstBlockInEra(eraId: number): Promise<BlockModel | undefined> {
        const firstBlock = await BlockModel(knex).where({ era: eraId }).orderBy('id').first()
        return firstBlock
      },
    },
    events: {
      save: async (event: EventModel): Promise<void> => {
        await EventModel(knex).insert(event).onConflict(['id']).merge()
      },
      findBySectionAndMethod: async (args: { section: string; method: string }[]): Promise<EventModel[]> => {
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
        await ExtrinsicModel(knex).insert(extrinsic).onConflict(['id']).merge()
      },
      findBySectionAndMethod: async (args: { section: string; method: string }[]): Promise<ExtrinsicModel[]> => {
        let query = ExtrinsicModel(knex).withSchema('dot_kusama')
        for (const { method, section } of args) {
          query = query.orWhere({ section, method })
        }
        const extrinsics = await query
        return extrinsics
      },
    },
  }
}

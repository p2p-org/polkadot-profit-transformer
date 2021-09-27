import { ExtrinsicModel } from './models/extrinsicModel'
import { Knex } from 'knex'
import { Logger } from '../../logger/logger'

export type ExtrinsicsRepository = ReturnType<typeof ExtrinsicsRepository>

export const ExtrinsicsRepository = (deps: { knex: Knex; logger: Logger }) => {
  const { knex, logger } = deps
  return {
    findBySectionAndMethod: async (args: { section: string; method: string }[]): Promise<ExtrinsicModel[]> => {
      let query = ExtrinsicModel(knex)
      for (const { method, section } of args) {
        query = query.orWhere({ section, method })
      }
      const extrinsics = await query
      return extrinsics
    },
  }
}

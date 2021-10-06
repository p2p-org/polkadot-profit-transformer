import { Knex } from 'knex'
import { Logger } from '../logger/logger'

import { IdentityModel } from './models/identity.model'

export type IdentityRepository = ReturnType<typeof IdentityRepository>

export const IdentityRepository = (deps: { knex: Knex; logger: Logger }) => {
  const { knex, logger } = deps
  return {
    save: async (identity: IdentityModel): Promise<void> => {
      await IdentityModel(knex).insert(identity).onConflict(['account_id']).merge()
    },
  }
}

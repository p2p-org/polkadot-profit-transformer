import { Knex } from 'knex'
import { Logger } from '../logger/logger'

import { IdentityModel } from './models/identity.model'

export type IdentityRepository = ReturnType<typeof IdentityRepository>

export const IdentityRepository = (deps: { knex: Knex; logger: Logger; networkId: number }) => {
  const { knex, logger, networkId } = deps
  const network = { network_id: networkId }

  return {
    save: async (identity: IdentityModel): Promise<void> => {
      await IdentityModel(knex)
        .insert({ ...identity, ...network })
        .onConflict(['account_id', 'network_id'])
        .merge()
    },
    findByAccountId: async (accountId: string): Promise<IdentityModel | undefined> => {
      const result = await IdentityModel(knex)
        .where({ account_id: accountId, ...network })
        .first()
      return result ?? undefined
    },
  }
}

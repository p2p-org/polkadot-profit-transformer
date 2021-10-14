import { NetworkModel } from './models/config.model'
import { Knex } from 'knex'
import { Logger } from '../logger/logger'

export type NetworksRepository = ReturnType<typeof NetworksRepository>

export const NetworksRepository = (deps: { knex: Knex; logger: Logger }) => {
  const { knex, logger } = deps
  return {
    save: async (network: NetworkModel): Promise<void> => {
      await NetworkModel(knex).insert(network).onConflict('name').merge()
    },
    getIdByName: async (name: string): Promise<number> => {
      const network = await NetworkModel(knex).where({ name }).first()
      if (!network) throw Error('NetworkRepository getIdByName ' + name + ' error: not found')
      return network.id!
    },
  }
}

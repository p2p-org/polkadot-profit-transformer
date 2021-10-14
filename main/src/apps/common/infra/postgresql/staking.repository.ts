import { EraModel } from './models/era.model'
import { Knex } from 'knex'
import { Logger } from '../logger/logger'
import { ValidatorModel } from './models/validator.model'
import { NominatorModel } from './models/nominator.model'

export type StakingRepository = ReturnType<typeof StakingRepository>

export const StakingRepository = (deps: { knex: Knex; logger: Logger; networkId: number }) => {
  const { knex, logger, networkId } = deps
  const network = { network_id: networkId }

  return {
    validators: {
      save: async (validator: ValidatorModel): Promise<void> => {
        await ValidatorModel(knex)
          .insert({ ...validator, ...network })
          .onConflict(['era', 'account_id', 'network_id'])
          .merge()
      },
    },
    nominators: {
      save: async (nominator: NominatorModel): Promise<void> => {
        await NominatorModel(knex)
          .insert({ ...nominator, ...network })
          .onConflict(['era', 'account_id', 'validator', 'network_id'])
          .merge()
      },
    },
    era: {
      save: async (era: EraModel): Promise<void> => {
        await EraModel(knex)
          .insert({ ...era, ...network })
          .onConflict(['era', 'network_id'])
          .merge()
      },
    },
  }
}

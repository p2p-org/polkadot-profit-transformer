import { EraModel } from './models/era.model'
import { Knex } from 'knex'
import { Logger } from '../logger/logger'
import { ValidatorModel } from './models/validator.model'
import { NominatorModel } from './models/nominator.model'

export type StakingRepository = ReturnType<typeof StakingRepository>

export const StakingRepository = (deps: { knex: Knex; logger: Logger }) => {
  const { knex, logger } = deps
  return {
    validators: {
      save: async (validator: ValidatorModel): Promise<void> => {
        await ValidatorModel(knex).insert(validator).onConflict(['era', 'account_id']).merge()
      },
    },
    nominators: {
      save: async (nominator: NominatorModel): Promise<void> => {
        await NominatorModel(knex).insert(nominator).onConflict(['era', 'account_id', 'validator']).merge()
      },
    },
    era: {
      save: async (era: EraModel): Promise<void> => {
        await EraModel(knex).insert(era).onConflict(['era']).merge()
      },
    },
  }
}

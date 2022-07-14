import { Knex } from 'knex'
import { environment } from '@apps/main/environment'

import { EraModel } from './models/era.model'
import { ValidatorModel } from './models/validator.model'
import { NominatorModel } from './models/nominator.model'
import { logger } from '../logger/logger'

const network = { network_id: environment.NETWORK_ID }

export type StakingRepository = ReturnType<typeof StakingRepository>

export const StakingRepository = (deps: { knex: Knex }) => (trx: Knex.Transaction<any, any[]>) => {
  const { knex } = deps

  return {
    validators: {
      save: async (validator: ValidatorModel): Promise<void> => {
        await ValidatorModel(knex)
          .transacting(trx)
          .insert({ ...validator, ...network })
      },
    },
    nominators: {
      save: async (nominator: NominatorModel): Promise<void> => {
        await NominatorModel(knex)
          .transacting(trx)
          .insert({ ...nominator, ...network })
      },
    },
    era: {
      save: async (era: EraModel): Promise<void> => {
        await EraModel(knex)
          .transacting(trx)
          .insert({ ...era, ...network })
      },
      findEraStartBlockId: async (eraId: number): Promise<number | undefined> => {
        // we don't have era record for era 0
        if (eraId === 0) return 0

        /* 
          we are trying to find prev. era payout record to 
          determine current paid era start block id
          it is possible when record has not been saved
          due to the parallel blocks processing
          so we should move current era processing task to the end 
          of the rabbit queue
          */
        const record = await EraModel(knex)
          .where({ era: eraId - 1 })
          .first()

        // if prev era record doesn't exist, return undefined
        return record?.payout_block_id
      },
    },
  }
}

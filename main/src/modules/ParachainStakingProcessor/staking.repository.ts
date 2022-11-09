import { Knex } from 'knex'
import { environment } from '@/environment'

import { RoundModel } from '@/models/round.model'
import { DelegatorModel } from '@/models/delegator.model'
import { CollatorModel } from '@/models/collator.model'

const network = { network_id: environment.NETWORK_ID }

export type StakingRepository = ReturnType<typeof StakingRepository>

export const StakingRepository = (deps: { knex: Knex }) => (trx: Knex.Transaction<any, any[]>) => {
  const { knex } = deps

  return {

    collators: {
      save: async (collator: CollatorModel): Promise<void> => {
        await CollatorModel(knex)
          .transacting(trx)
          .insert({ ...collator, ...network })
      },
    },
    delegators: {
      save: async (delegator: DelegatorModel): Promise<void> => {
        await DelegatorModel(knex)
          .transacting(trx)
          .insert({ ...delegator, ...network })
      },
    },
    round: {
      save: async (round: RoundModel): Promise<void> => {
        await RoundModel(knex)
          .transacting(trx)
          .insert({ ...round, ...network })
      },
      findRoundStartBlockId: async (roundId: number): Promise<number | undefined> => {
        // we don't have round record for round 0
        if (roundId === 2) return 0

        const record = await RoundModel(knex)
          .where({ round_id: roundId - 1 })
          .first()

        // if prev round record doesn't exist, return undefined
        return record?.payout_block_id
      },
    },
  }
}

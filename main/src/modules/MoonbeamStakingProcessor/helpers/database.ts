import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { environment } from '@/environment'
import { RoundModel } from '@/models/round.model'
import { DelegatorModel } from '@/models/delegator.model'
import { CollatorModel } from '@/models/collator.model'
import { RoundStakeModel } from '@/models/round_stake.model'
import { DelegatorStakeModel } from '@/models/delegator_stake.model'
import { CollatorStakeModel } from '@/models/collator_stake.model'

const network = { network_id: environment.NETWORK_ID }

@Service()
export class MoonbeamStakingProcessorDatabaseHelper {
  constructor(@Inject('knex') private readonly knex: Knex) {}

  async saveCollators(trx: Knex.Transaction<any, any[]>, collator: CollatorModel): Promise<void> {
    await CollatorModel(this.knex)
      .transacting(trx)
      .insert({ ...collator, ...network, row_time: new Date() })
  }
  async saveDelegators(trx: Knex.Transaction<any, any[]>, delegator: DelegatorModel): Promise<void> {
    await DelegatorModel(this.knex)
      .transacting(trx)
      .insert({ ...delegator, ...network, row_time: new Date() })
  }

  async saveRound(trx: Knex.Transaction<any, any[]>, round: RoundModel): Promise<void> {
    console.log({ ...round, ...network, row_time: new Date() })
    await RoundModel(this.knex)
      .transacting(trx)
      .insert({ ...round, ...network, row_time: new Date() })
  }

  async saveCollatorsStake(trx: Knex.Transaction<any, any[]>, collator: CollatorStakeModel): Promise<void> {
    await CollatorStakeModel(this.knex)
      .transacting(trx)
      .insert({ ...collator, ...network, row_time: new Date() })
  }
  async saveDelegatorsStake(trx: Knex.Transaction<any, any[]>, delegator: DelegatorStakeModel): Promise<void> {
    await DelegatorStakeModel(this.knex)
      .transacting(trx)
      .insert({ ...delegator, ...network, row_time: new Date() })
  }

  async saveRoundStake(trx: Knex.Transaction<any, any[]>, round: RoundStakeModel): Promise<void> {
    console.log({ ...round, ...network, row_time: new Date() })
    await RoundStakeModel(this.knex)
      .transacting(trx)
      .insert({ ...round, ...network, row_time: new Date() })
  }
}

import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { environment } from '@/environment'
import { DelegatorModel } from '@/models/delegator.model'
import { CollatorModel } from '@/models/collator.model'
import { StakeRoundModel } from '@/models/stake_round.model'
import { StakeDelegatorModel } from '@/models/stake_delegator.model'
import { StakeCollatorModel } from '@/models/stake_collator.model'
import { RewardRoundModel } from '@/models/reward_round.model'
import { RewardDelegatorModel } from '@/models/reward_delegator.model'
import { RewardCollatorModel } from '@/models/reward_collator.model'

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

  async saveStakeCollators(trx: Knex.Transaction<any, any[]>, collator: StakeCollatorModel): Promise<void> {
    await StakeCollatorModel(this.knex)
      .transacting(trx)
      .insert({ ...collator, ...network, row_time: new Date() })
  }
  async saveStakeDelegators(trx: Knex.Transaction<any, any[]>, delegator: StakeDelegatorModel): Promise<void> {
    await StakeDelegatorModel(this.knex)
      .transacting(trx)
      .insert({ ...delegator, ...network, row_time: new Date() })
  }

  async saveStakeRound(trx: Knex.Transaction<any, any[]>, round: StakeRoundModel): Promise<void> {
    await StakeRoundModel(this.knex)
      .transacting(trx)
      .insert({ ...round, ...network, row_time: new Date() })
  }

  async saveRewardsCollators(trx: Knex.Transaction<any, any[]>, collator: RewardCollatorModel): Promise<void> {
    await RewardCollatorModel(this.knex)
      .transacting(trx)
      .insert({ ...collator, ...network, row_time: new Date() })
  }
  async saveRewardsDelegators(trx: Knex.Transaction<any, any[]>, delegator: RewardDelegatorModel): Promise<void> {
    await RewardDelegatorModel(this.knex)
      .transacting(trx)
      .insert({ ...delegator, ...network, row_time: new Date() })
  }

  async saveRewardsRound(trx: Knex.Transaction<any, any[]>, round: RewardRoundModel): Promise<void> {
    await RewardRoundModel(this.knex)
      .transacting(trx)
      .insert({ ...round, ...network, row_time: new Date() })
  }
}

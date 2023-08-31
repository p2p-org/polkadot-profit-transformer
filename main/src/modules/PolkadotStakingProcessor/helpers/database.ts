import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { environment } from '@/environment'

import { EraModel } from '@/models/era.model'
import { ValidatorModel } from '@/models/validator.model'
import { NominatorModel } from '@/models/nominator.model'

import { StakeEraModel } from '@/models/stake_era.model'
import { StakeValidatorModel } from '@/models/stake_validator.model'
import { StakeNominatorModel } from '@/models/stake_nominator.model'

import { RewardEraModel } from '@/models/reward_era.model'
import { RewardValidatorModel } from '@/models/reward_validator.model'
import { RewardNominatorModel } from '@/models/reward_nominator.model'

const network = { network_id: environment.NETWORK_ID }

@Service()
export class PolkadotStakingProcessorDatabaseHelper {
  constructor(@Inject('knex') private readonly knex: Knex) {}

  async saveValidators(trx: Knex.Transaction<any, any[]>, validator: ValidatorModel): Promise<void> {
    await ValidatorModel(this.knex)
      .transacting(trx)
      .insert({ ...validator, ...network, row_time: new Date() })
  }

  async saveNominators(trx: Knex.Transaction<any, any[]>, nominator: NominatorModel): Promise<void> {
    await NominatorModel(this.knex)
      .transacting(trx)
      .insert({ ...nominator, ...network, row_time: new Date() })
  }

  async saveEra(trx: Knex.Transaction<any, any[]>, era: EraModel): Promise<void> {
    await EraModel(this.knex)
      .transacting(trx)
      .insert({ ...era, ...network, row_time: new Date() })
  }

  async saveStakeValidators(trx: Knex.Transaction<any, any[]>, validator: StakeValidatorModel): Promise<void> {
    await StakeValidatorModel(this.knex)
      .transacting(trx)
      .insert({ ...validator, ...network, row_time: new Date() })
  }

  async saveStakeNominators(trx: Knex.Transaction<any, any[]>, nominator: StakeNominatorModel): Promise<void> {
    await StakeNominatorModel(this.knex)
      .transacting(trx)
      .insert({ ...nominator, ...network, row_time: new Date() })
  }

  async saveStakeEra(trx: Knex.Transaction<any, any[]>, era: StakeEraModel): Promise<void> {
    await StakeEraModel(this.knex)
      .transacting(trx)
      .insert({ ...era, ...network, row_time: new Date() })
  }

  async saveRewardValidators(trx: Knex.Transaction<any, any[]>, validator: RewardValidatorModel): Promise<void> {
    await RewardValidatorModel(this.knex)
      .transacting(trx)
      .insert({ ...validator, ...network, row_time: new Date() })
  }

  async saveRewardNominators(trx: Knex.Transaction<any, any[]>, nominator: RewardNominatorModel): Promise<void> {
    await RewardNominatorModel(this.knex)
      .transacting(trx)
      .insert({ ...nominator, ...network, row_time: new Date() })
  }

  async saveRewardEra(trx: Knex.Transaction<any, any[]>, era: RewardEraModel): Promise<void> {
    await RewardEraModel(this.knex)
      .transacting(trx)
      .insert({ ...era, ...network, row_time: new Date() })
  }

  async findEraStartBlockId(trx: Knex.Transaction<any, any[]>, eraId: number): Promise<number | undefined> {
    // we don't have era record for era 0
    if (eraId === 0) return 0

    //kusama
    if (environment.NETWORK_ID === 2 && eraId === 760) {
      return 2204132
    }

    /* 
      we are trying to find prev. era payout record to 
      determine current paid era start block id
      it is possible when record has not been saved
      due to the parallel blocks processing
      so we should move current era processing task to the end 
      of the rabbit queue
      */
    console.log('pre1')
    const record = await StakeEraModel(this.knex).where({ era_id: eraId }).first()
    console.log('we are searching ', { era_id: eraId })
    console.log('pre1')
    console.log(record)

    console.log('pre2')

    // if prev era record doesn't exist, return undefined
    return record?.start_block_id
  }
}

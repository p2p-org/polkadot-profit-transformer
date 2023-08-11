import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { environment } from '@/environment'

import { EraModel } from '@/models/era.model'
import { ValidatorModel } from '@/models/validator.model'
import { NominatorModel } from '@/models/nominator.model'

import { EraStakeModel } from '@/models/era_stake.model'
import { ValidatorStakeModel } from '@/models/validator_stake.model'
import { NominatorStakeModel } from '@/models/nominator_stake.model'

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

  async saveValidatorsStake(trx: Knex.Transaction<any, any[]>, validator: ValidatorStakeModel): Promise<void> {
    await ValidatorStakeModel(this.knex)
      .transacting(trx)
      .insert({ ...validator, ...network, row_time: new Date() })
  }

  async saveNominatorsStake(trx: Knex.Transaction<any, any[]>, nominator: NominatorStakeModel): Promise<void> {
    await NominatorStakeModel(this.knex)
      .transacting(trx)
      .insert({ ...nominator, ...network, row_time: new Date() })
  }

  async saveEraStake(trx: Knex.Transaction<any, any[]>, era: EraStakeModel): Promise<void> {
    await EraStakeModel(this.knex)
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
    const record = await EraModel(this.knex)
      .where({ era_id: eraId - 1 })
      .first()

    // if prev era record doesn't exist, return undefined
    return record?.payout_block_id
  }
}

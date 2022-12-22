import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { environment } from '@/environment'
import { RoundModel } from '@/models/round.model'
import { DelegatorModel } from '@/models/delegator.model'
import { CollatorModel } from '@/models/collator.model'

const network = { network_id: environment.NETWORK_ID }

@Service()
export class MoonbeamStakingProcessorDatabaseHelper {

  constructor(
    @Inject('knex') private readonly knex: Knex,
  ) { }

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
    await RoundModel(this.knex)
      .transacting(trx)
      .insert({ ...round, ...network, row_time: new Date() })
  }

}

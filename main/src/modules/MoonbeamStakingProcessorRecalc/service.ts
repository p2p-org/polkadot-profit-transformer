import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { ApiPromise } from '@polkadot/api'
import { RoundModel } from '@/models/round.model'
import { CollatorModel } from '@/models/collator.model'
import { Logger } from 'pino'

@Service()
export class MoonbeamStakingProcessorRecalcService {

  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('knex') private readonly knex: Knex,
    @Inject('polkadotApi') private readonly polkadotApi: ApiPromise,
  ) {
    this.init()
  }


  async init(): Promise<void> {
    const roundRecords = await RoundModel(this.knex)
      .select()
      .orderBy('round_id', 'asc')
      //.where({ round_id: 1287 })
      .limit(50000)

    for (const round of roundRecords) {
      const collatorRecords = await CollatorModel(this.knex)
        .select()
        .where({ round_id: round.round_id })
        .limit(50000)

      for (const collator of collatorRecords) {
        const collatorsTotalRewardsSQL = `
          update collators 
          set total_reward=collator_reward+
            (select sum(reward) from delegators where round_id=${round.round_id} and collator_id='${collator.account_id}') 
          where round_id=${round.round_id} and account_id='${collator.account_id}'`
        console.log(collatorsTotalRewardsSQL)
        await this.knex.raw(collatorsTotalRewardsSQL)
      }


      const roundTotalRewardsSQL = `
        update rounds 
        set total_reward=(select sum(total_reward) from collators where round_id=${round.round_id}) 
        where round_id=${round.round_id}  
      `
      console.log(roundTotalRewardsSQL)
      await this.knex.raw(roundTotalRewardsSQL)

    }
  }


}

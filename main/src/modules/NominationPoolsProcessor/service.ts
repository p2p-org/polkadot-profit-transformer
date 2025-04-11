import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { v4 } from 'uuid'
import { QUEUES } from '@/loaders/rabbitmq'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@/models/processing_task.model'
import { NominationPoolsEraModel } from '@/models/nomination_pools_era.model'
import { NominationPoolsIdentitiesModel } from '@/models/nomination_pools_identities.model'
import { NominationPoolsMembersModel } from '@/models/nomination_pools_members.model'
import { PoolMemberData } from './interfaces'
import { Logger } from 'pino'
import { NominationPoolsProcessorDatabaseHelper } from './helpers/database'
import { NominationPoolsProcessorPolkadotHelper } from './helpers/polkadot'
import { SliMetrics } from '@/loaders/sli_metrics'
import { BN } from '@polkadot/util'
import { environment } from '@/environment'

@Service()
export class NominationPoolsProcessorService {
  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('sliMetrics') private readonly sliMetrics: SliMetrics,

    private readonly polkadotHelper: NominationPoolsProcessorPolkadotHelper,
    private readonly databaseHelper: NominationPoolsProcessorDatabaseHelper,
  ) {}

  async processTaskMessage(trx: Knex.Transaction, taskRecord: ProcessingTaskModel<ENTITY>): Promise<{ status: boolean }> {
    const { entity_id: eraId, collect_uid } = taskRecord

    const metadata = {
      block_process_uid: v4(),
      processing_timestamp: new Date(),
    }

    try {
      await this.processNominationPool(metadata, eraId + 1, taskRecord.data.payout_block_id, collect_uid, trx)
    } catch (error: any) {
      this.logger.warn({
        event: `error in processing era nomination pools: ${error.message}`,
      })
      throw error
    }

    return { status: true }
  }

  async processNominationPool(
    metadata: any,
    eraId: number,
    payout_block_id: number,
    collect_uid: string,
    trx: Knex.Transaction<any, any[]>,
  ): Promise<void> {
    const startProcessingTime = Date.now()
    this.logger.info({ event: `Process nomination pools data for next era: ${eraId}`, metadata, eraId })

    let blockId: number = payout_block_id
    //if (environment.NETWORK === 'polkadot') {
    //  blockId = payout_block_id;
    //}
    //if (environment.NETWORK === 'kusama') {
    //  blockId = payout_block_id;
    //}
    this.logger.info({ event: `Payout block is: ${payout_block_id}, but we extract from ${blockId}`, metadata, eraId })

    const payoutBlockHash = await this.polkadotHelper.getBlockHashByHeight(blockId)
    const poolsData = await this.polkadotHelper.getNominationPools({ blockHash: payoutBlockHash, eraId })

    for (let poolId in poolsData) {
      const pool = poolsData[poolId]

      const poolMetadata: NominationPoolsIdentitiesModel = {
        pool_id: pool?.id,
        pool_name: pool?.name,
        depositor_id: pool?.roles.depositor,
        root_id: pool?.roles.root,
        nominator_id: pool?.roles.nominator,
        toggler_id: pool?.roles.stateToggler,
        reward_id: pool?.roles.rewardAccount,
        stash_id: pool?.roles.stashAccount,
        commission: pool?.commission,
      }
      await this.databaseHelper.savePoolIdentity(trx, poolMetadata)

      const eraPoolData: NominationPoolsEraModel = {
        pool_id: pool?.id,
        era_id: eraId,
        state: pool?.state,
        members: pool?.memberCounter,
        points: pool?.points,
        reward_pool: pool?.rewardPools,
        sub_pool_storage: pool?.subPoolStorage,
      }
      await this.databaseHelper.saveEraPoolData(trx, eraPoolData)

      for (let i = 0; pool?.members && i <= Object.keys(pool?.members).length; i++) {
        const member = pool?.members[i]
        if (member?.account) {
          const eraPoolMember: NominationPoolsMembersModel = {
            pool_id: pool?.id,
            era_id: eraId,
            account_id: member?.account,
            points: member?.data?.points,
            last_recorded_reward_counter: member?.data?.lastRecordedRewardCounter,
            unbonding_eras: member?.data?.unbondingEras,
          }
          await this.databaseHelper.saveEraPoolMember(trx, eraPoolMember)
        }
      }

      //console.log(poolsData[poolId]);
    }

    this.logger.info({
      event: `Nomination pools for era ${eraId.toString()} processing finished in ${
        (Date.now() - startProcessingTime) / 1000
      } seconds.`,
      metadata,
      eraId,
    })

    await this.sliMetrics.add({
      entity: 'nomination_pools',
      entity_id: eraId,
      name: 'preprocess_time_ms',
      value: Date.now() - startProcessingTime,
    })
  }
}

import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { v4 } from 'uuid'
import { QUEUES } from '@/loaders/rabbitmq'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@/models/processing_task.model'
import { Logger } from 'pino'
import { EraModel } from '@/models/era.model'
import { PolkadotStakingProcessorDatabaseHelper } from './helpers/database'
import { PolkadotStakingProcessorPolkadotHelper } from './helpers/polkadot'
import { SliMetrics } from '@/loaders/sli_metrics'

@Service()
export class PolkadotStakingProcessorService {
  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('knex') private readonly knex: Knex,
    @Inject('sliMetrics') private readonly sliMetrics: SliMetrics,

    private readonly polkadotHelper: PolkadotStakingProcessorPolkadotHelper,
    private readonly databaseHelper: PolkadotStakingProcessorDatabaseHelper,
  ) { }

  async processTaskMessage(trx: Knex.Transaction, taskRecord: ProcessingTaskModel<ENTITY>): Promise<boolean> {
    const { entity_id: eraId, collect_uid } = taskRecord

    const metadata = {
      block_process_uid: v4(),
      processing_timestamp: new Date(),
    }

    await this.processStakeEra(metadata, eraId + 1, taskRecord.data.payout_block_id, collect_uid, trx)

    await this.processRewardsEra(metadata, eraId, taskRecord.data.payout_block_id, collect_uid, trx)

    return true
  }

  async processStakeEra(
    metadata: any,
    eraId: number,
    payout_block_id: number,
    collect_uid: string,
    trx: Knex.Transaction<any, any[]>,
  ): Promise<void> {
    const startProcessingTime = Date.now()
    this.logger.info({ event: `Process staking data for next era: ${eraId}`, metadata, eraId })

    const payoutBlockHash = await this.polkadotHelper.getBlockHashByHeight(payout_block_id)

    try {
      const eraData = await this.polkadotHelper.getEraDataStake({ blockHash: payoutBlockHash, eraId })

      const { validators, nominators } = await this.polkadotHelper.getValidatorsAndNominatorsStake({
        eraId: eraId,
        eraStartBlockId: payout_block_id,
      })

      await this.databaseHelper.saveStakeEra(trx, { ...eraData })

      for (const validator of validators) {
        await this.databaseHelper.saveStakeValidators(trx, validator)
      }

      for (const nominator of nominators) {
        await this.databaseHelper.saveStakeNominators(trx, nominator)
      }

      this.logger.info({
        event: `Era ${eraId.toString()} staking processing finished in ${(Date.now() - startProcessingTime) / 1000} seconds.`,
        metadata,
        eraId,
      })

      await this.sliMetrics.add({
        entity: 'era',
        entity_id: eraId,
        name: 'preprocess_time_ms',
        value: Date.now() - startProcessingTime,
      })
    } catch (error: any) {
      this.logger.warn({
        event: `error in processing era staking: ${error.message}`,
      })
      throw error
    }
  }

  async processRewardsEra(
    metadata: any,
    eraId: number,
    payout_block_id: number,
    collect_uid: string,
    trx: Knex.Transaction<any, any[]>,
  ): Promise<ProcessingTaskModel<ENTITY.ERA> | undefined> {
    const startProcessingTime = Date.now()
    this.logger.info({ event: `Process rewards for era: ${eraId}`, metadata, eraId })

    const eraStartBlockId = await this.databaseHelper.findEraStartBlockId(trx, eraId)

    // if no eraStartBlockId - recreate task in rabbit
    if (eraStartBlockId !== 0 && !eraStartBlockId) {
      const reprocessingTask: ProcessingTaskModel<ENTITY.ERA> = {
        entity: ENTITY.ERA,
        entity_id: eraId,
        status: PROCESSING_STATUS.NOT_PROCESSED,
        collect_uid,
        start_timestamp: new Date(),
        attempts: 0,
        data: { payout_block_id },
      }
      this.logger.warn({
        event: 'process-payouts eraStartBlockId not found, resend task to rabbit',
        reprocessingTask,
      })

      return
    }

    // logger.info({ eraStartBlockId })

    const payoutBlockHash = await this.polkadotHelper.getBlockHashByHeight(payout_block_id)

    // logger.info({ blockHash })

    try {
      const payoutBlockTime = await this.polkadotHelper.getBlockTime(payoutBlockHash)

      const eraData = {
        ...(await this.polkadotHelper.getEraDataStake({ blockHash: payoutBlockHash, eraId })),
        ...(await this.polkadotHelper.getEraDataRewards({ blockHash: payoutBlockHash, eraId })),
      }

      this.logger.info({
        event: 'process-payout',
        eraData,
      })

      const { validators, nominators } = await this.polkadotHelper.getValidatorsAndNominatorsPayout({
        eraId,
        eraStartBlockId,
        payoutBlockHash,
        payoutBlockTime,
      })

      await this.databaseHelper.saveEra(trx, { ...eraData, payout_block_id: payout_block_id })

      for (const validator of validators) {
        await this.databaseHelper.saveValidators(trx, validator)
      }

      for (const nominator of nominators) {
        await this.databaseHelper.saveNominators(trx, nominator)
      }

      //rewards only
      await this.databaseHelper.saveRewardEra(trx, { ...eraData })

      for (const validator of validators) {
        await this.databaseHelper.saveRewardValidators(trx, validator)
      }

      for (const nominator of nominators) {
        await this.databaseHelper.saveRewardNominators(trx, nominator)
      }

      this.logger.info({
        event: `Era ${eraId.toString()} staking processing finished in ${(Date.now() - startProcessingTime) / 1000} seconds.`,
        metadata,
        eraId,
      })

      await this.sliMetrics.add({
        entity: 'era',
        entity_id: eraId,
        name: 'process_time_ms',
        value: Date.now() - startProcessingTime,
      })
      await this.sliMetrics.add({ entity: 'era', entity_id: eraId, name: 'delay_time_ms', value: Date.now() - payoutBlockTime })

      const memorySize = Math.ceil(process.memoryUsage().heapUsed / (1024 * 1024))
      await this.sliMetrics.add({ entity: 'era', entity_id: eraId, name: 'memory_usage_mb', value: memorySize })
    } catch (error: any) {
      this.logger.warn({
        event: `error in processing era staking: ${error.message}`,
      })
      throw error
    }
  }
}

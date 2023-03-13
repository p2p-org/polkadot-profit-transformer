import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { v4 } from 'uuid'
import { logger } from '@/loaders/logger'
import { QUEUES, TaskMessage } from '@/loaders/rabbitmq'
import { TasksRepository } from '@/libs/tasks.repository'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@/models/processing_task.model'
import { Logger } from 'pino'

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
    private readonly tasksRepository: TasksRepository,
  ) {
  }


  async processTaskMessage<T extends QUEUES.Staking>(message: TaskMessage<T>): Promise<void> {
    const { entity_id: eraId, collect_uid } = message

    logger.info({
      event: 'RelaychainStakingProcessor.processTaskMessage',
      eraId,
      message: 'New process era task received',
      collect_uid,
    })

    const metadata = {
      block_process_uid: v4(),
      processing_timestamp: new Date(),
    }

    await this.tasksRepository.increaseAttempts(ENTITY.ERA, eraId)

    await this.knex.transaction(async (trx: Knex.Transaction) => {
      // try {
      const taskRecord = await this.tasksRepository.readTaskAndLockRow(ENTITY.ERA, eraId, trx)

      if (!taskRecord) {
        logger.warn({
          event: 'StakingProcessor.processTaskMessage.tx',
          eraId,
          error: 'Task record not found. Skip processing.',
          collect_uid,
        })
        return
      }

      if (taskRecord.collect_uid !== collect_uid) {
        logger.warn({
          event: `StakingProcessor.processTaskMessage.tx`,
          eraId,
          error: `Possible era ${eraId} processing task duplication. ` +
            `Expected ${collect_uid}, found ${taskRecord.collect_uid}. Skip processing.`,
          collect_uid,
        })
        return
      }

      if (taskRecord.status !== PROCESSING_STATUS.NOT_PROCESSED) {
        logger.warn({
          event: `StakingProcessor.processTaskMessage.tx`,
          eraId,
          message: `Era ${eraId} has been already processed. Skip processing.`,
          collect_uid,
        })
        return
      }

      // all is good, start processing era payout
      logger.info({
        event: `StakingProcessor.processTaskMessage.tx`,
        eraId,
        message: `Start processing payout for era ${eraId}`,
        ...metadata,
        collect_uid,
      })

      const eraReprocessingTask = await this.processEraPayout(
        metadata,
        eraId,
        taskRecord.data.payout_block_id,
        collect_uid,
        trx,
      )

      if (eraReprocessingTask) {
        logger.error({
          event: `StakingProcessor.processTaskMessage.tx`,
          eraId,
          error: `Processing failed. Rollback tx`,
          ...metadata,
          collect_uid,
          eraReprocessingTask,
        })

        await trx.rollback()
        //TODO: don't send it to rabbit. its creates infinite loop
        //await sendToRabbit(eraReprocessingTask)
        return
      }

      await this.tasksRepository.setTaskRecordAsProcessed(taskRecord, trx)

      logger.info({
        event: `StakingProcessor.processTaskMessage.tx`,
        eraId,
        message: `Era ${eraId} data created, commit transaction data`,
        ...metadata,
        collect_uid,
      })

      await trx.commit()

      logger.info({
        event: `StakingProcessor.processTaskMessage.tx`,
        eraId,
        message: `Era ${eraId} tx has been committed`,
        ...metadata,
        collect_uid,
        eraReprocessingTask,
      })
    }).catch((error: Error) => {
      logger.error({
        event: `StakingProcessor.processTaskMessage.tx`,
        eraId,
        error: error.message,
        data: {
          ...metadata,
          collect_uid,
        },
      })
      throw error
    })
  }


  async processEraPayout(
    metadata: any,
    eraId: number,
    payout_block_id: number,
    collect_uid: string,
    trx: Knex.Transaction<any, any[]>,
  ): Promise<ProcessingTaskModel<ENTITY.ERA> | undefined> {


    const startProcessingTime = Date.now()
    this.logger.info({ event: `Process staking payout for era: ${eraId}`, metadata, eraId })

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

      return reprocessingTask
    }

    // logger.info({ eraStartBlockId })

    const blockHash = await this.polkadotHelper.getBlockHashByHeight(payout_block_id)

    // logger.info({ blockHash })

    try {
      const blockTime = await this.polkadotHelper.getBlockTime(blockHash)

      const eraData = await this.polkadotHelper.getEraData({ blockHash, eraId })

      this.logger.info({
        event: 'process-payout',
        eraData,
      })

      const { validators, nominators } = await this.polkadotHelper.getValidatorsAndNominatorsData({
        blockHash, eraStartBlockId, eraId, blockTime
      })

      await this.databaseHelper.saveEra(trx, { ...eraData, payout_block_id: payout_block_id })

      for (const validator of validators) {
        await this.databaseHelper.saveValidators(trx, validator)
      }

      for (const nominator of nominators) {
        await this.databaseHelper.saveNominators(trx, nominator)
      }

      this.logger.info({
        event: `Era ${eraId.toString()} staking processing finished in ${(Date.now() - startProcessingTime) / 1000} seconds.`,
        metadata,
        eraId,
      })

      await this.sliMetrics.add(
        { entity: 'staking', entity_id: eraId, name: 'process_time_ms', value: Date.now() - startProcessingTime })
      await this.sliMetrics.add(
        { entity: 'staking', entity_id: eraId, name: 'delay_time_ms', value: Date.now() - blockTime })

      const memorySize = Math.ceil(process.memoryUsage().heapUsed / (1024 * 1024))
      await this.sliMetrics.add({ entity: 'staking', entity_id: eraId, name: 'memory_usage_mb', value: memorySize })

    } catch (error: any) {
      this.logger.warn({
        event: `error in processing era staking: ${error.message}`,
      })
      throw error
    }
  }
}
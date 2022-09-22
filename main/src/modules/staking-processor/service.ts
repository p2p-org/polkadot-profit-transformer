import { Knex } from 'knex'
import { v4 } from 'uuid'
import { StakingRepository } from '@/apps/common/infra/postgresql/staking.repository'
import { PolkadotRepository } from '@/apps/common/infra/polkadotapi/polkadot.repository'
import { logger } from '@/loaders/logger'
import { QUEUES, Rabbit, TaskMessage } from '@/loaders/rabbitmq'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@/models/processing_task.model'
import { ProcessingTasksRepository } from '@/apps/common/infra/postgresql/processing_tasks.repository'
import { processEraPayout } from './process-payout'

export type StakingProcessor = ReturnType<typeof StakingProcessor>

export const StakingProcessor = (args: {
  polkadotRepository: PolkadotRepository
  stakingRepository: StakingRepository
  processingTasksRepository: ProcessingTasksRepository
  rabbitMQ: Rabbit
  knex: Knex
}) => {
  const { polkadotRepository, stakingRepository, rabbitMQ, knex, processingTasksRepository } = args
  
  /*
  const sendToRabbit = async (eraReprocessingTask: ProcessingTaskModel<ENTITY.ERA>) => {
    const data = {
      era_id: eraReprocessingTask.entity_id,
      collect_uid: eraReprocessingTask.collect_uid,
    }
    await rabbitMQ.send<QUEUES.Staking>(QUEUES.Staking, data)
  }
  */

  const processTaskMessage = async <T extends QUEUES.Staking>(message: TaskMessage<T>) => {
    const { era_id: eraId, collect_uid } = message

    logger.info({
      event: 'PolkadotRepository.processTaskMessage',
      message: 'New process era task received',
      eraId,
      collect_uid,
    })

    const metadata = {
      block_process_uid: v4(),
      processing_timestamp: new Date(),
    }

    await knex.transaction(async (trx: Knex.Transaction) => {
      // try {
      const taskRecord = await processingTasksRepository.readTaskAndLockRow(ENTITY.ERA, eraId, trx)

      if (!taskRecord) {
        logger.warn({
          event: 'StakingProcessor.processTaskMessage.tx',
          error: 'Task record not found. Skip processing.',
          collect_uid,
        })
        return
      }

      if (taskRecord.collect_uid !== collect_uid) {
        logger.warn({
          event: `StakingProcessor.processTaskMessage.tx`,
          error: `Possible era ${eraId} processing task duplication. `+
                 `Expected ${collect_uid}, found ${taskRecord.collect_uid}. Skip processing.`,
          collect_uid,
        })
        return
      }

      if (taskRecord.status !== PROCESSING_STATUS.NOT_PROCESSED) {
        logger.warn({
          event: `StakingProcessor.processTaskMessage.tx`,
          message: `Era ${eraId} has been already processed. Skip processing.`,
          collect_uid,
        })
        return
      }

      // all is good, start processing era payout
      logger.info({
        event: `StakingProcessor.processTaskMessage.tx`,
        message: `Start processing payout for era ${eraId}`,
        ...metadata,
        collect_uid,
        eraId,
      })

      const eraReprocessingTask = await processEraPayout(
        metadata,
        eraId,
        taskRecord.data.payout_block_id,
        collect_uid,
        trx,
        stakingRepository,
        polkadotRepository,
      )

      if (eraReprocessingTask) {
        logger.error({
          event: `StakingProcessor.processTaskMessage.tx`,
          error: `Era reprocessing task found, rollback tx`,
          ...metadata,
          collect_uid,
          eraReprocessingTask,
        })

        await trx.rollback()
        //TODO: don't send it to rabbit. its creates infinite loop
        //await sendToRabbit(eraReprocessingTask)
        return
      }

      await processingTasksRepository.setTaskRecordAsProcessed(taskRecord, trx)

      logger.info({
        event: `StakingProcessor.processTaskMessage.tx`,
        message: `Era ${eraId} data created, commit transaction data`,
        ...metadata,
        collect_uid,
        eraId,
      })

      await trx.commit()

      logger.info({
        event: `StakingProcessor.processTaskMessage.tx`,
        message: `Era ${eraId} tx has been committed`,
        ...metadata,
        collect_uid,
        eraReprocessingTask,
        eraId,
      })
    }).catch( (error: Error) => {
      logger.error({
        event: `StakingProcessor.processTaskMessage.tx`,
        error: error.message,
        data: {
          ...metadata,
          collect_uid,
        },
      })
      throw error
    })
  }
  return {
    processTaskMessage,
  }
}
import { Knex } from 'knex'
import { v4 } from 'uuid'
import { ApiPromise } from '@polkadot/api'
import { StakingRepository } from '@/apps/common/infra/postgresql/staking.repository'
import { PolkadotRepository } from '@/apps/common/infra/polkadotapi/polkadot.repository'
import { logger } from '@/loaders/logger'
import { QUEUES, Rabbit, TaskMessage } from '@/loaders/rabbitmq'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@/models/processing_task.model'
import { ProcessingTasksRepository } from '@/apps/common/infra/postgresql/processing_tasks.repository'
import { processRoundPayout } from './process-payout'

export type ParachainStakingProcessor = ReturnType<typeof ParachainStakingProcessor>

export const ParachainStakingProcessor = (args: {
  polkadotApi: ApiPromise
  polkadotRepository: PolkadotRepository
  stakingRepository: StakingRepository
  processingTasksRepository: ProcessingTasksRepository
  rabbitMQ: Rabbit
  knex: Knex
}) => {
  const { polkadotApi, polkadotRepository, stakingRepository, rabbitMQ, knex, processingTasksRepository } = args
  
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
    const { entity_id: roundId, collect_uid } = message

    logger.info({
      event: 'PolkadotRepository.processTaskMessage',
      roundId,
      message: 'New process round task received',
      collect_uid,
    })

    const metadata = {
      block_process_uid: v4(),
      processing_timestamp: new Date(),
    }

    await knex.transaction(async (trx: Knex.Transaction) => {
      // try {
      const taskRecord = await processingTasksRepository.readTaskAndLockRow(ENTITY.ROUND, roundId, trx)

      if (!taskRecord) {
        logger.warn({
          event: 'StakingProcessor.processTaskMessage.tx',
          roundId,
          error: 'Task record not found. Skip processing.',
          collect_uid,
        })
        return
      }

      if (taskRecord.collect_uid !== collect_uid) {
        logger.warn({
          event: `StakingProcessor.processTaskMessage.tx`,
          roundId,
          error: `Possible round ${roundId} processing task duplication. `+
                 `Expected ${collect_uid}, found ${taskRecord.collect_uid}. Skip processing.`,
          collect_uid,
        })
        return
      }

      if (taskRecord.status !== PROCESSING_STATUS.NOT_PROCESSED) {
        logger.warn({
          event: `StakingProcessor.processTaskMessage.tx`,
          roundId,
          message: `Round ${roundId} has been already processed. Skip processing.`,
          collect_uid,
        })
        return
      }

      // all is good, start processing round payout
      logger.info({
        event: `StakingProcessor.processTaskMessage.tx`,
        roundId,
        message: `Start processing payout for round ${roundId}`,
        ...metadata,
        collect_uid,
      })

      const roundReprocessingTask = await processRoundPayout(
        metadata,
        roundId,
        taskRecord.data.payout_block_id,
        collect_uid,
        trx,
        stakingRepository,
        polkadotRepository,
        polkadotApi
      )
/*
      if (roundReprocessingTask) {
        logger.error({
          event: `StakingProcessor.processTaskMessage.tx`,
          roundId,
          error: `Processing failed. Rollback tx`,
          ...metadata,
          collect_uid,
          roundReprocessingTask,
        })

        await trx.rollback()
        //TODO: don't send it to rabbit. its creates infinite loop
        //await sendToRabbit(roundReprocessingTask)
        return
      }
*/
      await processingTasksRepository.setTaskRecordAsProcessed(taskRecord, trx)

      logger.info({
        event: `StakingProcessor.processTaskMessage.tx`,
        roundId,
        message: `Round ${roundId} data created, commit transaction data`,
        ...metadata,
        collect_uid,
      })

      await trx.commit()

      logger.info({
        event: `StakingProcessor.processTaskMessage.tx`,
        roundId,
        message: `Round ${roundId} tx has been committed`,
        ...metadata,
        collect_uid,
        roundReprocessingTask,
      })
    }).catch( (error: Error) => {
      logger.error({
        event: `StakingProcessor.processTaskMessage.tx`,
        roundId,
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

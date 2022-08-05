import { StakingRepository } from './../../apps/common/infra/postgresql/staking.repository'
import { PolkadotRepository } from 'apps/common/infra/polkadotapi/polkadot.repository'
import { logger } from '@apps/common/infra/logger/logger'
import { QUEUES, Rabbit, TaskMessage } from '@apps/common/infra/rabbitmq'
import { v4 } from 'uuid'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@apps/common/infra/postgresql/models/processing_task.model'
import { Knex } from 'knex'
import { ProcessingTasksRepository } from '@apps/common/infra/postgresql/processing_tasks.repository'
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

  const sendToRabbit = async (eraReprocessingTask: ProcessingTaskModel<ENTITY.ERA>) => {
    const data = {
      era_id: eraReprocessingTask.entity_id,
      collect_uid: eraReprocessingTask.collect_uid,
    }
    await rabbitMQ.send<QUEUES.Staking>(QUEUES.Staking, data)
  }

  const processTaskMessage = async <T extends QUEUES.Staking>(message: TaskMessage<T>) => {
    const { era_id: eraId, collect_uid } = message

    logger.info({
      event: 'new process era  task received',
      eraId,
      collect_uid,
    })

    const metadata = {
      block_process_uid: v4(),
      processing_timestamp: new Date(),
    }

    await knex.transaction(async (trx) => {
      // try {
      const taskRecord = await processingTasksRepository.readTaskAndLockRow(ENTITY.ERA, eraId, trx)

      if (!taskRecord) {
        throw new Error('StakingProcessor task record not found. Skip processing.')
      }

      if (taskRecord.collect_uid !== collect_uid) {
        throw new Error(
          `StakingProcessor: possible era ${eraId} processing task duplication. 
Expected ${collect_uid}, found ${taskRecord.collect_uid}. Skip processing.`,
        )
      }

      if (taskRecord.status !== PROCESSING_STATUS.NOT_PROCESSED) {
        throw new Error(`StakingProcessor: era  ${eraId} has been already processed. Skip processing.`)
      }

      // all is good, start processing era payout
      logger.info({
        event: `StakingProcessor: start processing payout for era ${eraId}`,
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
        logger.info({
          event: `eraReprocessingTask found, resend to rabbit, rollback tx`,
          ...metadata,
          collect_uid,
          eraReprocessingTask,
        })

        await trx.rollback()
        await sendToRabbit(eraReprocessingTask)
        return
      }

      await processingTasksRepository.setTaskRecordAsProcessed(taskRecord, trx)

      logger.info({
        event: `era ${eraId} data created, commit transaction data`,
        ...metadata,
        collect_uid,
        eraId,
      })

      logger.info({
        event: `era ${eraId} tx has been committed`,
        ...metadata,
        collect_uid,
        eraReprocessingTask,
        eraId,
      })
    })
  }
  return {
    processTaskMessage,
  }
}

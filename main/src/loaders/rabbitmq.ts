import { ConfirmChannel, ConsumeMessage } from 'amqplib'
import AmqpConnectionManager from 'amqp-connection-manager'
//import { IAmqpConnectionManager } from 'amqp-connection-manager/dist/esm/AmqpConnectionManager'
import { environment } from '@/environment'
import { logger } from '@/loaders/logger'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@/models/processing_task.model'
import { TasksRepository } from '@/libs/tasks.repository'
import Container from 'typedi'
import { Knex } from 'knex'

export enum QUEUES {
  Blocks = 'process_blocks',
  Balances = 'process_balances',
  BlocksMetadata = 'process_metadata',
  Staking = 'process_staking',
}

export type TaskMessage<T> = {
  entity_id: number
  collect_uid: string
}

export type QueueProcessor<T extends QUEUES> = {
  processTaskMessage: (trx: Knex.Transaction<any, any[]>, task: ProcessingTaskModel<ENTITY>) => Promise<boolean>
}

export type Rabbit = {
  send: <T extends QUEUES>(queue: T, message: TaskMessage<T>) => Promise<void>
  process: <T extends QUEUES>(queue: T, entity: ENTITY, processor: QueueProcessor<T>) => Promise<void>
}

export const RabbitMQ = async (connectionString: string): Promise<Rabbit> => {
  const connection: any = await AmqpConnectionManager.connect(connectionString)

  connection.on('connect', () => {
    logger.info({ msg: '✌️ RabbitMQ connected' })
  })
  connection.on('close', (error: Error) => {
    logger.error({ event: 'RabbitMQ.connection', message: 'Connection closed', error })
  })
  connection.on('error', (error: Error) => {
    logger.error({ event: 'RabbitMQ.connection', message: 'Connection error', error })
  })
  connection.on('disconnect', (error: Error) => {
    logger.error({ event: 'RabbitMQ.connection', message: 'Connection disconnected', error })
  })
  connection.on('blocked', (reason: string) => {
    logger.warn({ event: 'RabbitMQ.connection', message: `Connection blocked: ${reason}` })
  })
  connection.on('unblocked', () => {
    logger.warn({ event: 'RabbitMQ.connection', message: `Connection unblocked` })
  })

  const channelWrapper = connection.createChannel({
    json: true,
    setup: function (channel: ConfirmChannel) {
      // `channel` here is a regular amqplib `ConfirmChannel`.
      // Note that `this` here is the channelWrapper instance.
      return Promise.all([
        channel.assertQueue(environment.NETWORK + ':' + QUEUES.Staking),
        channel.assertQueue(environment.NETWORK + ':' + QUEUES.Blocks),
        channel.assertQueue(environment.NETWORK + ':' + QUEUES.Balances),
        channel.assertQueue(environment.NETWORK + ':' + QUEUES.BlocksMetadata),
        channel.prefetch(1),
      ])
    },
  })

  const tasksRepository = Container.get(TasksRepository)
  const knex: Knex = Container.get('knex')

  const preProcessTaskMessage = async <T extends QUEUES>(
    entity: ENTITY,
    message: TaskMessage<T>,
    processor: QueueProcessor<T>,
  ): Promise<void> => {
    const { entity_id, collect_uid } = message

    logger.info({
      event: 'RabbitMQ.processTaskMessage',
      message: 'New task received',
      entity,
      entity_id,
      collect_uid,
    })

    await tasksRepository.increaseAttempts(entity, entity_id, collect_uid)

    await knex
      .transaction(async (trx: Knex.Transaction) => {
        // try {
        const taskRecord = await tasksRepository.readTaskAndLockRow(entity, entity_id, collect_uid, trx)

        if (!taskRecord) {
          logger.warn({
            event: 'RabbitMQ.preProcessTaskMessage',
            entity,
            entity_id,
            collect_uid,
            error: 'Task record not found. Skip processing.',
          })
          return
        }

        if (taskRecord.status !== PROCESSING_STATUS.NOT_PROCESSED) {
          logger.warn({
            event: `RabbitMQ.preProcessTaskMessage`,
            entity,
            entity_id,
            message: `${entity} with id ${entity_id} status in not 'not_processed'. Skip processing.`,
            collect_uid,
          })
          return
        }

        // all is good, start processing era payout
        logger.info({
          event: `RabbitMQ.preProcessTaskMessage`,
          message: `Start processing ${entity} width id ${entity_id}`,
          entity,
          entity_id,
          collect_uid,
        })

        if (!(await processor.processTaskMessage(trx, taskRecord))) {
          logger.error({
            event: `StakingProcessor.preProcessTaskMessage`,
            entity,
            entity_id,
            collect_uid,
            error: `Processing failed. Rollback tx`,
          })

          await trx.rollback()
          //TODO: don't send it to rabbit. its creates infinite loop
          //await sendToRabbit(eraReprocessingTask)
          return
        }

        await tasksRepository.setTaskRecordAsProcessed(trx, taskRecord)

        logger.info({
          event: `RabbitMQ.preProcessTaskMessage`,
          message: `${entity} with id ${entity_id} data created, commit transaction data`,
          entity,
          entity_id,
          collect_uid,
        })

        await trx.commit()

        logger.info({
          event: `RabbitMQ.preProcessTaskMessage`,
          message: `${entity} with id ${entity_id} tx has been committed`,
          entity,
          entity_id,
          collect_uid,
        })
      })
      .catch((error: Error) => {
        logger.error({
          event: `RabbitMQ.processTaskMessage`,
          error: error.message,
          entity,
          entity_id,
          collect_uid,
        })
        throw error
      })
  }

  return {
    send: async <T extends QUEUES>(queue: T, message: TaskMessage<T>) => {
      logger.debug({ event: 'RabbitMQ.send!', message, buffer: Buffer.from(JSON.stringify(message)) })
      await channelWrapper.sendToQueue(environment.NETWORK + ':' + queue, message)

      console.log(222);
    },
    process: async <T extends QUEUES>(queue: T, entity: ENTITY, processor: QueueProcessor<T>) => {
      const consumer = async (msg: ConsumeMessage | null): Promise<void> => {
        if (msg) {
          logger.debug({
            event: 'RabbitMQ.process',
            message: msg.content.toString(),
          })
          const message = JSON.parse(msg.content.toString()) //as TaskMessage<T>
          try {
            //await processor.processTaskMessage(message)
            await preProcessTaskMessage(entity, message, processor)
            logger.debug({ event: 'memory', message: Math.ceil(process.memoryUsage().heapUsed / (1024 * 1024)) })
            channelWrapper.ack(msg)
          } catch (error: any) {
            logger.error({ event: 'RabbitMQ.process', error: error.message, message })

            //TODO: ?
            channelWrapper.ack(msg)
          }
        }
      }
      await channelWrapper.consume(environment.NETWORK + ':' + queue, consumer)
    },
  }
}

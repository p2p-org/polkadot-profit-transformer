import { Channel, ConfirmChannel, Connection, ConsumeMessage } from 'amqplib'
import { environment } from '@apps/main/environment'
import { logger } from '../logger/logger'
import { IAmqpConnectionManager } from 'amqp-connection-manager/dist/esm/AmqpConnectionManager'

export enum QUEUES {
  Blocks = 'process_blocks',
  Staking = 'process_staking',
}

export type TaskMessage<T> = T extends QUEUES.Blocks
  ? {
      block_id: number
      collect_uid: string
    }
  : {
      era_id: number
      collect_uid: string
    }

export type QueueProcessor<T extends QUEUES> = {
  processTaskMessage: (msg: TaskMessage<T>) => Promise<void>
}

export type Rabbit = {
  send: <T extends QUEUES>(queue: T, message: TaskMessage<T>) => Promise<void>
  process: <T extends QUEUES>(queue: T, processor: QueueProcessor<T>) => Promise<void>
}

export const RABBIT = async (connection: IAmqpConnectionManager): Promise<Rabbit> => {
  var channelWrapper = connection.createChannel({
    json: true,
    setup: function (channel: ConfirmChannel) {
      // `channel` here is a regular amqplib `ConfirmChannel`.
      // Note that `this` here is the channelWrapper instance.
      return Promise.all([
        channel.assertQueue(environment.NETWORK + ':' + QUEUES.Staking),
        channel.assertQueue(environment.NETWORK + ':' + QUEUES.Blocks),
        channel.prefetch(1),
      ])
    },
  })

  return {
    send: async <T extends QUEUES>(queue: T, message: TaskMessage<T>) => {
      logger.debug({ event: 'rabbitmq.send', message, buffer: Buffer.from(JSON.stringify(message)) })
      await channelWrapper.sendToQueue(environment.NETWORK + ':' + queue, message)
    },
    process: async <T extends QUEUES>(queue: T, processor: QueueProcessor<T>) => {
      const consumer =
        // (channel) =>
        async (msg: ConsumeMessage | null): Promise<void> => {
          if (msg) {
            logger.debug({
              event: 'rabbitMq.process',
              message: msg.content.toString(),
            })
            const message = JSON.parse(msg.content.toString()) //as TaskMessage<T>
            try {
              await processor.processTaskMessage(message)
              // console.log('ACK MESSAGE')
              console.log('memory', process.memoryUsage().heapUsed)
              channelWrapper.ack(msg)
            } catch (error: any) {
              logger.error({ event: 'rabbit.process error', error: error.message, message })
            }
          }
        }
      await channelWrapper.consume(environment.NETWORK + ':' + queue, consumer)
    },
  }
}

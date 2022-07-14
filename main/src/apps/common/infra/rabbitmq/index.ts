import { Channel, Connection, ConsumeMessage } from 'amqplib'
import { environment } from '@apps/main/environment'
import { logger } from '../logger/logger'

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

export const RABBIT = async (connection: Connection): Promise<Rabbit> => {
  const channel: Channel = await connection.createChannel()
  await channel.assertQueue(environment.NETWORK + ':' + QUEUES.Staking)
  await channel.assertQueue(environment.NETWORK + ':' + QUEUES.Blocks)
  await channel.prefetch(1)

  return {
    send: async <T extends QUEUES>(queue: T, message: TaskMessage<T>) => {
      logger.debug({ event: 'rabbitmq.send', message })
      await channel.sendToQueue(environment.NETWORK + ':' + queue, Buffer.from(JSON.stringify(message)), {
        persistent: true,
      })
    },
    process: async <T extends QUEUES>(queue: T, processor: QueueProcessor<T>) => {
      const consumer =
        (channel: Channel) =>
        async (msg: ConsumeMessage | null): Promise<void> => {
          if (msg) {
            logger.debug({
              event: 'rabbitMq.process',
              message: msg.content.toString(),
            })
            const message = JSON.parse(msg.content.toString()) as TaskMessage<T>
            try {
              await processor.processTaskMessage(message)
              console.log('ACK MESSAGE')
            } catch (error: any) {
              logger.error({ event: 'rabbit.process error', error: error.message, message })
            }
            channel.ack(msg)
          }
        }
      await channel.consume(environment.NETWORK + ':' + queue, consumer(channel))
    },
  }
}

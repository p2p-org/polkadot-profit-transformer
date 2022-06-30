import { Channel, Connection, ConsumeMessage } from 'amqplib'
import { environment } from '@apps/main/environment'
import { logger } from '../logger/logger'

export enum QUEUES {
  Blocks = 'process_blocks',
  Staking = 'process_staking',
}

export type QueueProcessor = {
  process: (msg: any) => Promise<void>
}

export type Rabbit = {
  send: (queue: QUEUES, message: any) => Promise<void>
  process: (queue: QUEUES, processor: QueueProcessor) => Promise<void>
}

export const RABBIT = async (connection: Connection): Promise<Rabbit> => {
  const channel: Channel = await connection.createChannel()
  // await channel.assertQueue(environment.NETWORK + ':' + QUEUES.Staking)
  await channel.assertQueue(environment.NETWORK + ':' + QUEUES.Blocks)
  await channel.prefetch(1)

  return {
    send: async (queue: QUEUES, message: any) => {
      await channel.sendToQueue(environment.NETWORK + ':' + queue, Buffer.from(JSON.stringify(message)))
    },
    process: async (queue: QUEUES, processor: QueueProcessor) => {
      const consumer =
        (channel: Channel) =>
        async (msg: ConsumeMessage | null): Promise<void> => {
          if (msg) {
            // Display the received message
            logger.debug('rabbit received message', msg.content.toString())
            const jsonMessage = JSON.parse(msg.content.toString())
            await processor.process(jsonMessage)
            // Acknowledge the message

            channel.ack(msg)
          }
        }
      await channel.consume(environment.NETWORK + ':' + queue, consumer(channel))
    },
  }
}

import { Channel, Connection, ConsumeMessage } from 'amqplib'

export enum QUEUES {
  Staking = 'Staking',
  Governance = 'Governance',
  Identity = 'Identity',
}

export type QueueProcessor = {
  process: (msg: any) => Promise<void>
}

export type Rabbit = {
  send: (queue: QUEUES, message: any) => Promise<void>
  process: (queue: QUEUES, processor: QueueProcessor) => Promise<void>
}

export const RABBITMQ = async (connection: Connection): Promise<Rabbit> => {
  const channel: Channel = await connection.createChannel()
  await channel.assertQueue('Staking')
  await channel.prefetch(1)

  return {
    send: async (queue: QUEUES, message: any) => {
      await channel.sendToQueue(queue, Buffer.from(JSON.stringify(message)))
    },
    process: async (queue: QUEUES, processor: QueueProcessor) => {
      const consumer =
        (channel: Channel) =>
        async (msg: ConsumeMessage | null): Promise<void> => {
          if (msg) {
            // Display the received message
            console.log(msg.content.toString())
            const jsonMMessage = JSON.parse(msg.content.toString())
            await processor.process(jsonMMessage)
            // Acknowledge the message

            channel.ack(msg)
          }
        }
      await channel.consume(queue, consumer(channel))
    },
  }
}

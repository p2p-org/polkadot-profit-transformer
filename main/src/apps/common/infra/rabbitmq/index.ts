import { Channel, ConfirmChannel, Connection, ConsumeMessage } from 'amqplib'
import { IAmqpConnectionManager } from 'amqp-connection-manager/dist/esm/AmqpConnectionManager'
import { Logger } from 'apps/common/infra/logger/logger'

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

export const RABBIT = async (connection: IAmqpConnectionManager, logger: Logger): Promise<Rabbit> => {
  var channelWrapper = connection.createChannel({
    json: true,
    setup: function (channel: ConfirmChannel) {
      // `channel` here is a regular amqplib `ConfirmChannel`.
      // Note that `this` here is the channelWrapper instance.
      return Promise.all([channel.assertQueue(process.env.NETWORK + ':' + QUEUES.Staking), channel.prefetch(1)])
    },
  })

  return {
    send: async (queue: QUEUES, message: any) => {
      await channelWrapper.sendToQueue(process.env.NETWORK + ':' + queue, message)
    },
    process: async (queue: QUEUES, processor: QueueProcessor) => {
      const consumer =
        // (channel: Channel) =>
        async (msg: ConsumeMessage | null): Promise<void> => {
          if (msg) {
            // logger.debug({
            //   event: 'rabbitMq.process',
            //   message: msg.content.toString(),
            // })
            const message = JSON.parse(msg.content.toString()) //as TaskMessage<T>
            try {
              const jsonMessage = JSON.parse(msg.content.toString())
              await processor.process(jsonMessage)
              // console.log('ACK MESSAGE')
              console.log('memory', process.memoryUsage().heapUsed)
              channelWrapper.ack(msg)
            } catch (error: any) {
              logger.error({ event: 'rabbit.process error', error: error.message, message })
            }
          }
        }
      await channelWrapper.consume(process.env.NETWORK + ':' + queue, consumer)
    },
  }
}

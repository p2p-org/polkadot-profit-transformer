import { Kafka, Producer } from 'kafkajs';
import fastifyPlugin from 'fastify-plugin';
import { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    kafkaProducer: Producer
  }
}

const {
  environment: { APP_CLIENT_ID, KAFKA_URI }
} = require('../environment')

const kafkaProducer = async (server: FastifyInstance) => {
  server.log.info(`Init "kafkaProducer"`)

  const kafka = new Kafka({
    clientId: APP_CLIENT_ID,
    brokers: [KAFKA_URI]
  })

  const producer = kafka.producer()
  await producer.connect()

  server.decorate('kafkaProducer', producer)
}

export const registerKafkaPlugin = fastifyPlugin(kafkaProducer);

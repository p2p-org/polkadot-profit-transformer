import { Producer } from 'kafkajs'
import fastifyPlugin from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { KafkaModule } from '../modules/kafka.module'

declare module 'fastify' {
  interface FastifyInstance {
    kafkaProducer: Producer
  }
}

const kafkaProducer = async (server: FastifyInstance) => {
  server.log.info(`Init "kafkaProducer"`)
  server.decorate('kafkaProducer', KafkaModule.inject())
}

export const registerKafkaPlugin = fastifyPlugin(kafkaProducer)

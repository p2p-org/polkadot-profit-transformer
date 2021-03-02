const { Kafka } = require('kafkajs')
const fastifyPlugin = require('fastify-plugin')

const { environment: { APP_CLIENT_ID, KAFKA_URI } } = require('../environment')

const kafkaProducer = async (server, options = {}) => {
  server.log.info(`Init "kafkaProducer"`)

  const kafka = new Kafka({
    clientId: APP_CLIENT_ID,
    brokers: [KAFKA_URI]
  })

  const producer = kafka.producer()
  await producer.connect()

  server.decorate('kafkaProducer', producer)
}

module.exports = fastifyPlugin(kafkaProducer)

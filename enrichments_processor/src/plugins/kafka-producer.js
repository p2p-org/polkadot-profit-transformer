const { Kafka } = require('kafkajs')
const fastifyPlugin = require('fastify-plugin')

const { KAFKA_URI } = require('../environment')

const kafkaProducer = async (server, options = {}) => {
  const kafka = new Kafka({
    clientId: 'mbelt-enrichments',
    brokers: [KAFKA_URI]
  })

  const producer = kafka.producer()
  await producer.connect()

  server.decorate('kafkaProducer', producer)
}

module.exports = fastifyPlugin(kafkaProducer)

const { Kafka } = require('kafkajs')
const fastifyPlugin = require('fastify-plugin')

const { KAFKA_URI } = require('../environment')

const kafkaConnector = async (server, options = {}) => {
  const kafka = new Kafka({
    clientId: 'polkadot-streamer',
    brokers: [KAFKA_URI]
  })

  const producer = kafka.producer()
  await producer.connect()

  server.decorate('kafkaConnector', producer)
}

module.exports = fastifyPlugin(kafkaConnector)

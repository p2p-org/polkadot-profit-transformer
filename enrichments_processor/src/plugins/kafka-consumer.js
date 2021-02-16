const { Kafka } = require('kafkajs')
const fastifyPlugin = require('fastify-plugin')

const { APP_CLIENT_ID, KAFKA_PREFIX, KAFKA_URI } = require('../environment')

const kafkaConsumer = async (server, options = {}) => {
  server.log.info(`Init "kafkaConsumer"`)

  const kafka = new Kafka({
    clientId: APP_CLIENT_ID,
    brokers: [KAFKA_URI]
  })

  const consumer = kafka.consumer({
    groupId: APP_CLIENT_ID
  })
  await consumer.connect()

  await consumer.subscribe({
    topic: new RegExp(KAFKA_PREFIX +'_ENRICHMENT_.*', 'i'),
    fromBeginning: true
  })

  server.decorate('kafkaConsumer', consumer)
}

module.exports = fastifyPlugin(kafkaConsumer)

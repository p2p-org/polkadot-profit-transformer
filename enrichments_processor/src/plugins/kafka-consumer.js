const { Kafka } = require('kafkajs')
const fastifyPlugin = require('fastify-plugin')

const { KAFKA_URI } = require('../environment')

const kafkaConsumer = async (server, options = {}) => {
  const kafka = new Kafka({
    clientId: 'mbelt-enrichments',
    brokers: [KAFKA_URI]
  })

  const consumer = kafka.consumer({
    groupId: 'mbelt'
  })
  await consumer.connect()

  await consumer.subscribe({
    topic: /enrichment_.*/i,
    fromBeginning: true
  })

  server.decorate('kafkaConsumer', consumer)
}

module.exports = fastifyPlugin(kafkaConsumer)

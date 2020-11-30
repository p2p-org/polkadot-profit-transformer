const Fastify = require('fastify')
const { RunnerService } = require('./services/runner')

const { LOG_LEVEL } = require('./environment')

const argv = require('yargs')
  .option('disable-rpc', {
    alias: 'disable-rpc',
    type: 'boolean',
    default: false,
    description: 'Disable api'
  })
  .help().argv

const build = async () => {
  const fastify = Fastify({
    bodyLimit: 1048576 * 2,
    logger: {
      level: LOG_LEVEL,
      prettyPrint: true
    }
  })

  // plugins
  await require('./plugins/kafka-consumer')(fastify)

  await require('./plugins/kafka-producer')(fastify)

  await require('./plugins/polkadot-connector')(fastify)

  if (!argv['disable-rpc']) {
    await fastify.register(require('./routes'), { prefix: 'api' })
  }

  // hooks
  fastify.addHook('onClose', (instance, done) => {
    //  stop sync, disconnect
    const { polkadotConnector } = instance
    polkadotConnector.disconnect()
  })

  fastify.ready().then(
    () => {
      const runner = new RunnerService(fastify)
      runner.start()
    },
    (err) => {
      fastify.log.info(`Fastify ready error: ${err}`)
    }
  )

  return fastify
}

module.exports = {
  build
}

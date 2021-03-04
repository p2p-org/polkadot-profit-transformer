const Fastify = require('fastify')
const { RunnerService } = require('./services/runner')

const {
  environment: { LOG_LEVEL },
  validateEnv
} = require('./environment')

const argv = require('yargs')
  .option('sync', {
    type: 'boolean',
    default: false,
    description: 'Run synchronization blocks, fetched with db'
  })
  .option('sync-force', {
    type: 'boolean',
    default: false,
    description: 'Run synchronization all blocks'
  })
  .option('sync-stakers', {
    type: 'boolean',
    default: false,
    description: 'Run synchronization stakers'
  })
  .option('start', {
    type: 'number',
    default: 0,
    description: 'Start synchronization from block number'
  })
  .option('sub-fin-head', {
    type: 'boolean',
    default: false,
    description: 'Subscribe to capture finalized heads'
  })
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

  try {
    await validateEnv(fastify)
  } catch (err) {
    fastify.log.error(`Environment variable error: "${err.message}"`)
    fastify.log.error(`Stopping instance...`)
    process.exit(1)
  }

  fastify.log.info(`Init plugins...`)

  // plugins
  try {
    await require('./plugins/postgres-connector')(fastify)
  } catch (err) {
    fastify.log.error(`Cannot init plugin: "${err.message}"`)
    fastify.log.error(`Stopping instance...`)
    process.exit(1)
  }

  try {
    await require('./plugins/kafka-producer')(fastify)
  } catch (err) {
    fastify.log.error(`Cannot init plugin: "${err.message}"`)
    fastify.log.error(`Stopping instance...`)
    process.exit(1)
  }

  try {
    await require('./plugins/polkadot-connector')(fastify)
  } catch (err) {
    fastify.log.error(`Cannot init plugin: "${err.message}"`)
    fastify.log.error(`Stopping instance...`)
    process.exit(1)
  }

  if (!argv['disable-rpc']) {
    try {
      await fastify.register(require('./routes'), { prefix: 'api' })
    } catch (err) {
      fastify.log.error(`Cannot init endpoint: "${err.message}"`)
      fastify.log.error(`Stopping instance...`)
      process.exit(1)
    }
  }

  // hooks
  fastify.addHook('onClose', (instance, done) => {
    //  stop sync, disconnect
    const { postgresConnector } = instance
    postgresConnector.end()

    const { polkadotConnector } = instance
    polkadotConnector.disconnect()
  })

  fastify.ready().then(
    () => {
      const runner = new RunnerService(fastify)
      runner.sync(
        {
          optionSync: argv['sync-force'] ? false : argv.sync,
          optionSyncForce: argv['sync-force'],
          optionSyncValidators: argv['sync-stakers'],
          optionSyncStartBlockNumber: argv.start,
          optionSubscribeFinHead: argv['sub-fin-head']
        },
        argv['sub-fin-head']
      )
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

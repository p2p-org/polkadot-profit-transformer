import Fastify from 'fastify'
import { RunnerService } from './services/runner/runner'
import routes from './routes'
import { registerKafkaPlugin, registerPolkadotPlugin, registerPostgresPlugin } from './plugins'
import { environment, validateEnv } from './environment'
import yargs from 'yargs'

const { argv } = yargs
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
  .option('watchdog', {
    type: 'boolean',
    default: false,
    description: 'Run watchdog'
  })
  .option('watchdog-concurrency', {
    type: 'number',
    default: 10,
    description: 'Concurrency of watchdog threads'
  })
  .option('watchdog-start', {
    type: 'number',
    default: 0,
    description: 'Start watchdog tests from block number'
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
  .help()

const build = async () => {
  const fastify = Fastify({
    bodyLimit: 1048576 * 2,
    logger: {
      level: environment.LOG_LEVEL,
      prettyPrint: true
    }
  })

  try {
    await validateEnv()
  } catch (err) {
    fastify.log.error(`Environment variable error: "${err.message}"`)
    fastify.log.error(`Stopping instance...`)
    process.exit(1)
  }

  fastify.log.info(`Init plugins...`)

  // plugins
  try {
    await registerPostgresPlugin(fastify, {})
    await registerKafkaPlugin(fastify, {})
    await registerPolkadotPlugin(fastify, {})
  } catch (err) {
    fastify.log.error(`Cannot init plugin: "${err.message}"`)
    fastify.log.error(`Stopping instance...`)
    process.exit(1)
  }

  if (!argv['disable-rpc']) {
    try {
      await fastify.register(routes, { prefix: 'api' })
    } catch (err) {
      fastify.log.error(`Cannot init endpoint: "${err.message}"`)
      fastify.log.error(`Stopping instance...`)
      process.exit(1)
    }
  }

  // hooks
  fastify.addHook('onClose', (instance) => {
    //  stop sync, disconnect
    const { postgresConnector } = instance
    postgresConnector.end()

    const { polkadotConnector } = instance
    polkadotConnector.disconnect()
  })

  try {
    await fastify.ready()
    const runner = new RunnerService(fastify)
    await runner.sync({
      optionSync: argv['sync-force'] ? false : argv.sync,
      optionSyncForce: argv['sync-force'],
      optionSyncValidators: argv['sync-stakers'],
      optionSyncStartBlockNumber: argv.start,
      optionSubscribeFinHead: argv['sub-fin-head'],
      optionStartWatchdog: argv['watchdog'],
      optionWatchdogStartBlockNumber: argv['watchdog-start'],
      optionWatchdogConcurrency: argv['watchdog-concurrency']
    })
  } catch (err) {
    throw err
    // fastify.log.info(`Fastify ready error: ${err}`)
  }

  return fastify
}

export { build }

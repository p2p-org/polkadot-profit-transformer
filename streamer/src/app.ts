import Fastify, { FastifyInstance } from 'fastify'
import { RunnerService } from './services/runner/runner'
import routes from './routes'
import { validateEnv } from './environment'
import yargs from 'yargs'
import prometheus from './routes/api/prometheus'
import { PolkadotModule } from './modules/polkadot.module'
import { KafkaModule } from './modules/kafka.module'
import { PostgresModule } from './modules/postgres.module'
import { LoggerModule } from './modules/logger.module'

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
  .option('start', {
    type: 'number',
    description: 'Start synchronization from block number'
  })
  .option('watchdog', {
    type: 'boolean',
    default: false,
    description: 'Run watchdog'
  })
  .option('watchdog-start', {
    type: 'number',
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

const initModules = async (): Promise<void> => {
  await LoggerModule.init()
  await PostgresModule.init()
  await PolkadotModule.init()
  await KafkaModule.init()
}

const build = async (): Promise<FastifyInstance> => {
  await initModules()
  const fastify = Fastify({
    bodyLimit: 1048576 * 2,
    logger: LoggerModule.inject()
  })

  try {
    await validateEnv()
  } catch (err) {
    fastify.log.error(`Environment variable error: "${err.message}"`)
    fastify.log.error(`Stopping instance...`)
    process.exit(1)
  }

  fastify.log.info(`Init plugins...`)

  if (!argv['disable-rpc']) {
    try {
      await fastify.register(routes, { prefix: 'api' })
      await fastify.register(prometheus, { prefix: '/' })
    } catch (err) {
      console.log(err)
      fastify.log.error(`Cannot init endpoint: "${err.message}"`)
      fastify.log.error(`Stopping instance...`)
      process.exit(1)
    }
  }

  try {
    await fastify.ready()
  } catch (err) {
    throw err
    // fastify.log.info(`Fastify ready error: ${err}`)
  }

  return fastify
}

const runner = async (): Promise<void> => {
  const runner = new RunnerService()
  await runner.sync({
    optionSync: argv['sync-force'] ? false : argv.sync,
    optionSyncForce: argv['sync-force'],
    optionSyncStartBlockNumber: argv.start,
    optionSubscribeFinHead: argv['sub-fin-head'],
    optionStartWatchdog: argv['watchdog'],
    optionWatchdogStartBlockNumber: argv['watchdog-start']
  })
}

export { build, runner }

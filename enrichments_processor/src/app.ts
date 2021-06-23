import Fastify, { FastifyInstance } from 'fastify'
import { RunnerService } from './services/runner/runner'
import { validateEnv } from './environment'
import { KafkaModule } from './modules/kafka.module'
import { LoggerModule } from './modules/logger.module'
import { PolkadotModule } from './modules/polkadot.module'

const initModules = async (): Promise<void> => {
  await LoggerModule.init()
  await KafkaModule.init()
  await PolkadotModule.init()
}

const build = async (): Promise<FastifyInstance> => {
  await initModules()
  const fastify = Fastify({
    bodyLimit: 1048576 * 2,
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
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

  try {
    await fastify.ready()
  } catch (err) {
    throw err
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  return fastify
}

const runner = async (): Promise<void> => {
  const runner = new RunnerService()
  await runner.start()
}

export { build, runner }

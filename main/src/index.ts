import { sleep } from '@/utils/sleep'
import { environment, MODE } from '@/environment'

import { KnexPG } from '@/loaders/knex'
import { QUEUES, RabbitMQ } from '@/loaders/rabbitmq'
import { logger } from '@/loaders/logger'

import { PreloaderRestApi } from '@/modules/BlockListener/controller'
import { BlocksPreloader } from '@/modules/BlockListener/service'

import { BlockProcessorApi } from '@/modules/BlockProcessor/controller'
import { BlockProcessor } from '@/modules/BlockProcessor/service'

import { RelaychainStakingProcessorRestApi } from '@/modules/RelaychainStakingProcessor/controller'
import { RelaychainStakingProcessor } from '@/modules/RelaychainStakingProcessor/service'

import { ParachainStakingProcessorRestApi } from '@/modules/ParachainStakingProcessor/controller'
import { ParachainStakingProcessor } from '@/modules/ParachainStakingProcessor/service'

import { PolkadotApi } from '@/loaders/polkadotapi'

import { ProcessingTasksRepository } from '@/apps/common/infra/postgresql/processing_tasks.repository'


const main = async () => {
  console.log({ environment })

  logger.info('Main app started')

  const pg = await KnexPG(environment.PG_CONNECTION_STRING, environment.LOG_LEVEL === 'debug')
  const rabbitMQ = await RabbitMQ(environment.RABBITMQ!)

  const polkadotApi = await PolkadotApi(environment.SUBSTRATE_URI)()
  const processingTasksRepository = await ProcessingTasksRepository({ knex: pg })

  if (environment.MODE === MODE.LISTENER) {
    logger.debug('preload blocks')

    const blocksPreloader = BlocksPreloader({
      polkadotApi,
      processingTasksRepository,
      rabbitMQ,
      knex: pg,
    })

    process.on('SIGTERM', async () => {
      console.log('SIGTERM')
      await blocksPreloader.gracefullShutdown()
      console.log('Ready to shutdown!')
      await sleep(10000)
      process.exit(0)
    })

    process.on('SIGINT', async () => {
      console.log('SIGINT')
      await blocksPreloader.gracefullShutdown()
      console.log('Ready to shutdown!')
      await sleep(10000)
      process.exit(0)
    })

    const restApi = PreloaderRestApi({ blocksPreloader })
    restApi.init()

    //await blocksPreloader.preload()
    //await blocksPreloader.preloadOneBlock(1858800)
  }

  if (environment.MODE === MODE.BLOCK_PROCESSOR) {
    logger.debug('BLOCK_PROCESSOR mode')

    const blockProcessor = await BlockProcessor({
      polkadotApi,
      processingTasksRepository,
      rabbitMQ,
      knex: pg,
    })

    rabbitMQ.process(QUEUES.Blocks, blockProcessor)

    const restApi = BlockProcessorApi()
    restApi.init()
  }

  if (environment.MODE === MODE.STAKING_PROCESSOR) {
    logger.debug('STAKING_PROCESSOR mode')

    if (environment.NETWORK === 'polkadot' || environment.NETWORK === 'kusama') {
      const stakingProcessor = RelaychainStakingProcessor({
        polkadotApi,
        processingTasksRepository,
        rabbitMQ,
        knex: pg,
      })

      rabbitMQ.process(QUEUES.Staking, stakingProcessor)

      const restApi = RelaychainStakingProcessorRestApi()
      restApi.init()

    } else {
      const stakingProcessor = ParachainStakingProcessor({
        polkadotApi,
        processingTasksRepository,
        rabbitMQ,
        knex: pg,
      })

      rabbitMQ.process(QUEUES.Staking, stakingProcessor)

      const restApi = ParachainStakingProcessorRestApi()
      restApi.init()
    }
  }
}

main().catch((error) => {
  console.log('Error in igniter main function', error.message)
  throw error
})

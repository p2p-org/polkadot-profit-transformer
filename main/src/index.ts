import { sleep } from '@/utils/sleep'
import { environment, MODE } from '@/environment'

import { KnexPG } from '@/loaders/knex'
import { QUEUES, RabbitMQ } from '@/loaders/rabbitmq'
import { logger } from '@/loaders/logger'

import { PreloaderRestApi } from '@/modules/listener/controller'
import { BlocksPreloader } from '@/modules/listener/service'

import { BlockProcessorApi } from '@/modules/block-processor/controller'
import { BlockProcessor } from '@/modules/block-processor/service'

import { StakingProcessorRestApi } from '@/modules/staking-processor/controller'
import { StakingProcessor } from '@/modules/staking-processor/service'

import { polkadotFactory } from '@/apps/common/infra/polkadotapi/index'

import { PolkadotRepository } from '@/apps/common/infra/polkadotapi/polkadot.repository'
import { StakingRepository } from '@/apps/common/infra/postgresql/staking.repository'
import { StreamerRepository } from '@/apps/common/infra/postgresql/streamer.repository'

import { ProcessingTasksRepository } from '@/apps/common/infra/postgresql/processing_tasks.repository'
import { ProcessingStatusRepository } from '@/apps/common/infra/postgresql/processing_status.repository'

const main = async () => {
  console.log({ environment })

  logger.info('Main app started')

  const pg = await KnexPG(environment.PG_CONNECTION_STRING, environment.LOG_LEVEL === 'debug')
  const rabbitMQ = await RabbitMQ(environment.RABBITMQ!)

  const polkadotApi = await polkadotFactory(environment.SUBSTRATE_URI)()
  const polkadotRepository = await PolkadotRepository({ polkadotApi })
  const processingTasksRepository = await ProcessingTasksRepository({ knex: pg })
  const processingStatusRepository = await ProcessingStatusRepository({ knex: pg })

  const streamerRepository = StreamerRepository({ knex: pg })
  const stakingRepository = StakingRepository({ knex: pg })

  if (environment.MODE === MODE.LISTENER) {
    logger.debug('preload blocks')

    const blocksPreloader = BlocksPreloader({
      processingTasksRepository,
      processingStatusRepository,
      polkadotRepository: polkadotRepository,
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

    // // express rest api
    const restApi = PreloaderRestApi({ blocksPreloader })
    restApi.init()

    await blocksPreloader.preload()
    //await blocksPreloader.preloadOneBlock(8259074)
  }

  if (environment.MODE === MODE.BLOCK_PROCESSOR) {
    logger.debug('BLOCK_PROCESSOR mode')

    const blockProcessor = await BlockProcessor({
      polkadotRepository,
      streamerRepository,
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

    const stakingProcessor = StakingProcessor({
      polkadotRepository,
      stakingRepository,
      processingTasksRepository,
      rabbitMQ,
      knex: pg,
    })

    rabbitMQ.process(QUEUES.Staking, stakingProcessor)

    const restApi = StakingProcessorRestApi()
    restApi.init()
  }
}

main().catch((error) => {
  console.log('Error in igniter main function', error.message)
  throw error
})


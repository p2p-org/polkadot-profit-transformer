import { RestApi } from './rest-api/index'
import knex from 'knex'
import client, { Connection } from 'amqplib'

import { ExtrinsicsProcessor } from '../../modules/streamer/extrinsics-processor'
import { EventsProcessor } from '../../modules/streamer/events-processor'
import { BlockProcessor } from '../../modules/streamer/block-processor'
import { StakingProcessor } from '@modules/staking-processor'

import { environment, MODE } from './environment'
import { polkadotFactory } from '../common/infra/polkadotapi/index'

import { PolkadotRepository } from './../common/infra/polkadotapi/polkadot.repository'
import { StakingRepository } from './../common/infra/postgresql/staking.repository'
import { StreamerRepository } from './../common/infra/postgresql/streamer.repository'

import { BlocksPreloader } from '../../modules/streamer/blocks-preloader'

import { RABBIT } from '@apps/common/infra/rabbitmq'
import { ProcessingTasksRepository } from '@apps/common/infra/postgresql/preloader.repository'
import { logger } from '@apps/common/infra/logger/logger'

const main = async () => {
  console.log({ environment })

  logger.info('Main app started')

  const pg = knex({
    client: 'pg',
    debug: false, //process.env.LOG_LEVEL === 'debug',
    connection: {
      connectionString: environment.PG_CONNECTION_STRING,
      ssl: false,
    },
    searchPath: ['knex', 'public'],
  })

  const rabbitConnection: Connection = await client.connect(environment.RABBITMQ!)
  const rabbitMQ = await RABBIT(rabbitConnection)

  const polkadotApi = await polkadotFactory(environment.SUBSTRATE_URI)()
  const polkadotRepository = await PolkadotRepository({ polkadotApi })
  const processingTasksRepository = await ProcessingTasksRepository({ knex: pg })

  // const streamerRepository = StreamerRepository({ knex: pg, logger, networkId })
  // const stakingRepository = StakingRepository({ knex: pg, logger, networkId })
  // const eventsProcessor = EventsProcessor({ logger })
  // const extrinsicsProcessor = ExtrinsicsProcessor({ polkadotRepository: await polkadotRepository() })
  // const blockProcessor = BlockProcessor({
  //   polkadotRepository: await polkadotRepository(),
  //   eventsProcessor,
  //   extrinsicsProcessor,
  //   logger,
  //   streamerRepository,
  //   chainName,
  //   rabbitMQ,
  // })
  // const stakingProcessor = StakingProcessor({
  //   polkadotRepository: await polkadotRepository(),
  //   streamerRepository,
  //   stakingRepository,
  //   logger,
  // })

  // const stakingQueue: QUEUES = QUEUES.Staking
  // rabbitMQ.process(stakingQueue, stakingProcessor)

  const blocksPreloader = BlocksPreloader({
    processingTasksRepository,
    polkadotRepository: polkadotRepository,
    rabbitMQ,
  })

  if (environment.MODE === MODE.LISTENER) {
    logger.debug('preload blocks')
    await blocksPreloader.preload()

    logger.debug('preload done, go listening to the new blocks')

    polkadotRepository.subscribeFinalizedHeads((header) => blocksPreloader.newBlock(header.number.toNumber()))
  }

  // // express rest api
  // const restApi = RestApi({ environment, blocksPreloader, blockProcessor, stakingProcessor, rabbitMQ })
  // restApi.init()
}

main().catch((error) => console.log('Error in igniter main function', error.message))

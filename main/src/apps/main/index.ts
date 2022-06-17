import { RestApi } from './rest-api/index'
import knex from 'knex'
import client, { Connection } from 'amqplib'

import { IdentityProcessor } from './../../modules/identity-processor/index'
import { ExtrinsicsProcessor } from '../../modules/streamer/extrinsics-processor'
import { EventsProcessor } from '../../modules/streamer/events-processor'
import { BlockProcessor } from '../../modules/streamer/block-processor'

import { environment } from './environment'
import { polkadotFactory } from '../common/infra/polkadotapi/index'
import { LoggerFactory as PinoLogger } from '../common/infra/logger/logger'
import { EventBus, EventName } from '@modules/event-bus/event-bus'

import { PolkadotRepository } from './../common/infra/polkadotapi/polkadot.repository'
import { IdentityRepository } from './../common/infra/postgresql/identity.repository'
import { StakingRepository } from './../common/infra/postgresql/staking.repository'
import { StreamerRepository } from './../common/infra/postgresql/streamer.repository'
import { GovernanceRepository } from '../common/infra/postgresql/governance.repository'

import { BlocksPreloader } from '../../modules/streamer/blocks-preloader'
import { ExtrinsicProcessor } from '../../modules/governance-processor/processors/extrinsics'
import { GovernanceProcessor } from '../../modules/governance-processor'
import { EventProcessor } from '@modules/governance-processor/processors/events'
import { StakingProcessor } from '@modules/staking-processor'
import { NetworksRepository } from '@apps/common/infra/postgresql/networks_repository'
import { NetworkModel } from '@apps/common/infra/postgresql/models/config.model'
import { QUEUES, RABBIT } from '@apps/common/infra/rabbitmq'

const main = async () => {
  const logger = PinoLogger({ logLevel: environment.LOG_LEVEL! })

  logger.info('Main app started')

  const pg = knex({
    client: 'pg',
    debug: process.env.LOG_LEVEL === 'debug',
    connection: {
      connectionString: environment.PG_CONNECTION_STRING,
      ssl: false,
    },
    searchPath: ['knex', 'public'],
  })

  const rabbitConnection: Connection = await client.connect(environment.RABBITMQ!)
  const rabbitMQ = await RABBIT(rabbitConnection)

  const polkadotApi = await polkadotFactory(environment.SUBSTRATE_URI!)
  const eventBus = EventBus({ logger })

  const polkadotRepository = async () => PolkadotRepository({ polkadotApi: await polkadotApi(), logger })
  const networksRepository = NetworksRepository({ knex: pg, logger })

  // get current network from node
  const chainName = await (await polkadotRepository()).getChainInfo()
  const network: NetworkModel = { name: chainName }
  await networksRepository.save(network)
  const networkId = await networksRepository.getIdByName(chainName)

  const streamerRepository = StreamerRepository({ knex: pg, logger, networkId })
  const stakingRepository = StakingRepository({ knex: pg, logger, networkId })
  const identityRepository = IdentityRepository({ knex: pg, logger, networkId })
  const governanceRepository = GovernanceRepository({ knex: pg, logger, networkId })

  const extrinsicProcessor = ExtrinsicProcessor({ governanceRepository, logger, polkadotApi: await polkadotApi() })
  const eventProcessor = EventProcessor({ governanceRepository, logger, polkadotApi: await polkadotApi() })
  const governanceProcessor = GovernanceProcessor({ extrinsicProcessor, eventProcessor, logger })
  const eventsProcessor = EventsProcessor({ logger })
  const extrinsicsProcessor = ExtrinsicsProcessor({ polkadotRepository: await polkadotRepository() })

  const blockProcessor = BlockProcessor({
    polkadotRepository: await polkadotRepository(),
    eventsProcessor,
    extrinsicsProcessor,
    logger,
    eventBus,
    streamerRepository,
    chainName,
    rabbitMQ,
  })

  const stakingProcessor = StakingProcessor({
    polkadotRepository: await polkadotRepository(),
    streamerRepository,
    stakingRepository,
    logger,
  })

  const identityProcessor = IdentityProcessor({ polkadotRepository: await polkadotRepository(), identityRepository, logger })

  const stakingQueue: QUEUES = QUEUES.Staking
  rabbitMQ.process(stakingQueue, stakingProcessor)

  // todo fix generics to register and dispatch in eventBus
  // eventBus.register(EventName.eraPayout, stakingProcessor.addToQueue)
  eventBus.register(EventName.identityEvent, identityProcessor.processEvent)
  eventBus.register(EventName.identityExtrinsic, identityProcessor.processIdentityExtrinsics)
  eventBus.register(EventName.subIdentityExtrinsic, identityProcessor.processSubIdentityExtrinsics)
  eventBus.register(EventName.governanceExtrinsic, governanceProcessor.processExtrinsicsHandler)
  eventBus.register(EventName.governanceEvent, governanceProcessor.processEventHandler)

  const concurrency = environment.CONCURRENCY // how many blocks processed in parallel by BlocksPreloaders
  const blocksPreloader = BlocksPreloader({
    streamerRepository,
    blockProcessor,
    polkadotRepository: await polkadotRepository(),
    logger,
    concurrency,
  })

  // express rest api
  const restApi = RestApi({ environment, blocksPreloader, blockProcessor, stakingProcessor, rabbitMQ })
  restApi.init()

  // blocksPreloader fills up database from block 0 to current block
  if (environment.PRELOAD) {
    const startBlockId = environment.START_BLOCK_ID
    await blocksPreloader.start(startBlockId)
  }

  if (environment.SUBSCRIBE)
    // now we have all previous blocks pprocessed and we are listening to the finalized block events
    (await polkadotRepository()).subscribeFinalizedHeads((header) => blockProcessor(header.number.toNumber()))
}

main().catch((error) => console.log('Error in igniter main function', error.message))

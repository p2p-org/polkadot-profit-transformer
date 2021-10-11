import { RestApi } from './rest-api/index'
import knex from 'knex'
import yargs from 'yargs'

import { IdentityProcessor } from './../../modules/identity-processor/index'
import { ExtrinsicsProcessor } from '../../modules/streamer/extrinsics-processor'
import { EventsProcessor } from '../../modules/streamer/events-processor'
import { BlockProcessor } from '../../modules/streamer/block-processor'

import { environment } from './environment'
import { polkadotFactory } from '../common/infra/polkadotapi/index'
import { LoggerFactory as PinoLogger } from '../common/infra/logger/logger'
import { EventBus } from 'utils/event-bus/event-bus'

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

const main = async () => {
  // parse start params from command line
  const { argv } = yargs.option('resync', {
    type: 'boolean',
    default: false,
    description: 'Sync from the a genesis block',
  })

  const logger = PinoLogger({ logLevel: environment.LOG_LEVEL! })

  const pg = knex({
    client: 'pg',
    debug: process.env.LOG_LEVEL === 'debug',
    connection: {
      connectionString: environment.PG_CONNECTION_STRING,
      ssl: false,
    },
    searchPath: ['knex', environment.DB_SCHEMA!],
  })

  const polkadotApi = await polkadotFactory(environment.SUBSTRATE_URI!)
  const eventBus = EventBus({ logger })

  const streamerRepository = StreamerRepository({ knex: pg, logger })
  const stakingRepository = StakingRepository({ knex: pg, logger })
  const identityRepository = IdentityRepository({ knex: pg, logger })
  const governanceRepository = GovernanceRepository({ knex: pg, logger })
  const polkadotRepository = PolkadotRepository({ polkadotApi, logger })

  const extrinsicProcessor = ExtrinsicProcessor({ governanceRepository, logger, polkadotApi })
  const eventProcessor = EventProcessor({ governanceRepository, logger, polkadotApi })
  const governanceProcessor = GovernanceProcessor({ extrinsicProcessor, eventProcessor, logger })

  const eventsProcessor = EventsProcessor({ logger })
  const extrinsicsProcessor = ExtrinsicsProcessor({ polkadotRepository })
  const blockProcessor = BlockProcessor({
    polkadotRepository,
    eventsProcessor,
    extrinsicsProcessor,
    logger,
    eventBus,
    streamerRepository,
  })
  const stakingProcessor = StakingProcessor({ polkadotRepository, streamerRepository, stakingRepository, logger })
  const identityProcessor = IdentityProcessor({ polkadotRepository, identityRepository, logger })

  // todo fix generics to register and dispatch in eventBus
  eventBus.register('eraPayout', stakingProcessor.addToQueue)
  eventBus.register('identityEvent', identityProcessor.processEvent)
  eventBus.register('identityExtrinsic', identityProcessor.processIdentityExtrinsics)
  eventBus.register('subIdentityExtrinsic', identityProcessor.processSubIdentityExtrinsics)
  eventBus.register('governanceExtrinsic', governanceProcessor.processExtrinsicsHandler)
  eventBus.register('governanceEvent', governanceProcessor.processEventHandler)

  const concurrency = 10 // how many blocks processed in parallel by BlocksPreloaders
  const blocksPreloader = BlocksPreloader({ streamerRepository, blockProcessor, polkadotRepository, logger, concurrency })

  // express rest api
  const restApi = RestApi({ environment, blocksPreloader, blockProcessor })
  restApi.init()

  // blocksPreloader fills up database from block 0 to current block
  const startBlockId = argv.resync ? 0 : undefined
  await blocksPreloader.start(startBlockId)
  // await blockProcessor(2213295)

  // now we have all previous blocks pprocessed and we are listening to the finalized block events
  polkadotRepository.subscribeFinalizedHeads((header) => blockProcessor(header.number.toNumber()))
}

main()

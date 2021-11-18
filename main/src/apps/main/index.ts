import { RestApi } from './rest-api/index'
import knex from 'knex'

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
import { NetworksRepository } from '@apps/common/infra/postgresql/networks_repository'
import { NetworkModel } from '@apps/common/infra/postgresql/models/config.model'

const main = async () => {
  const logger = PinoLogger({ logLevel: environment.LOG_LEVEL! })

  const pg = knex({
    client: 'pg',
    debug: process.env.LOG_LEVEL === 'debug',
    connection: {
      connectionString: environment.PG_CONNECTION_STRING,
      ssl: false,
    },
    searchPath: ['knex', 'public'],
  })

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
  })
  const stakingProcessor = StakingProcessor({
    polkadotRepository: await polkadotRepository(),
    streamerRepository,
    stakingRepository,
    logger,
  })
  const identityProcessor = IdentityProcessor({ polkadotRepository: await polkadotRepository(), identityRepository, logger })

  // todo fix generics to register and dispatch in eventBus
  eventBus.register('eraPayout', stakingProcessor.addToQueue)
  eventBus.register('identityEvent', identityProcessor.processEvent)
  eventBus.register('identityExtrinsic', identityProcessor.processIdentityExtrinsics)
  eventBus.register('subIdentityExtrinsic', identityProcessor.processSubIdentityExtrinsics)
  eventBus.register('governanceExtrinsic', governanceProcessor.processExtrinsicsHandler)
  eventBus.register('governanceEvent', governanceProcessor.processEventHandler)

  const payoutBlocks = [
    6884145, 6898544, 6912942, 6927342, 6941739, 6956133, 6970532, 6984928, 6999325, 7013721, 7028114, 7042480, 7056870, 7071265,
    7085662, 7100054, 7114450, 7128842, 7143239, 7157623, 7171975, 7186191, 7199833, 7214114, 7228486, 7242865, 7257258, 7271652,
    7286044, 7300435, 7314828, 7329220, 7343577, 7357911, 7372278, 7386590, 7400882, 7415209, 7429527, 7443838, 7458128, 7472412,
    7486657, 7500907, 7515226, 7529522, 7543858, 7558187, 7572349, 7586592, 7600846, 7615036, 7629211, 7643373, 7657558, 7671952,
    7686343, 7700734, 7715129, 7729523,
  ]

  // let index = 0
  // while (index < targetEvents.length) {
  //   const blockId = targetEvents[index].block_id

  //   console.log(index, ': process block ', blockId)

  //   try {
  //     /*  if (blockId > 6661795)  */ await stakingProcessor.addToQueue(targetEvents[index])
  //   } catch (error: any) {
  //     console.log('Error in debug loop: ' + error.message)
  //     throw error
  //   }

  //   index++
  // }

  let index = 0

  while (index < payoutBlocks.length) {
    const blockId = payoutBlocks[index]
    console.log(index, blockId)
    blockProcessor(blockId)
    index++
  }
}

main().catch((error) => console.log('Error in igniter main function', error))

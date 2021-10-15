import { IdentityProcessor } from './../../modules/identity-processor/index'
import { ExtrinsicsProcessor } from '../../modules/streamer/extrinsics-processor'
import { EventsProcessor } from '../../modules/streamer/events-processor'
import { BlockProcessor } from '../../modules/streamer/block-processor'
import knex from 'knex'

import { environment } from './environment'
import { polkadotFactory } from '../common/infra/polkadotapi/index'
import { LoggerFactory as PinoLogger } from '../common/infra/logger/logger'
import { EventBus } from 'utils/event-bus/event-bus'

import { PolkadotRepository } from './../common/infra/polkadotapi/polkadot.repository'
import { IdentityRepository } from './../common/infra/postgresql/identity.repository'
import { StakingRepository } from './../common/infra/postgresql/staking.repository'
import { StreamerRepository } from './../common/infra/postgresql/streamer.repository'
import { GovernanceRepository } from '../common/infra/postgresql/governance.repository'

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
    debug: false,
    connection: {
      connectionString: environment.PG_CONNECTION_STRING,
      ssl: false,
    },
    searchPath: ['knex', 'public'],
  })

  const pg_prod = knex({
    client: 'pg',
    debug: true,
    connection: {
      connectionString:
        'postgresql://app_streamer_polkadot:xDKd@t5_Cw0oXjw4Xv7y2Xm@r2_P1-5MjRcPdlKxPS@lNxRo_3@localhost:5435/mbelt_substrate_polkadot?schema=mbelt',
      ssl: false,
    },
    searchPath: ['knex', 'public'],
  })

  const polkadotApi = await polkadotFactory(environment.SUBSTRATE_URI!)
  const eventBus = EventBus({ logger })

  const polkadotRepository = PolkadotRepository({ polkadotApi, logger })
  const networksRepository = NetworksRepository({ knex: pg, logger })

  // get current network from node
  const chainName = await polkadotRepository.getChainInfo()
  const network: NetworkModel = { name: chainName }
  await networksRepository.save(network)
  const networkId = await networksRepository.getIdByName(chainName)

  const streamerProdRepository = StreamerRepository({ knex: pg_prod, logger, networkId })

  const streamerRepository = StreamerRepository({ knex: pg, logger, networkId })
  const stakingRepository = StakingRepository({ knex: pg, logger, networkId })
  const identityRepository = IdentityRepository({ knex: pg, logger, networkId })
  const governanceRepository = GovernanceRepository({ knex: pg, logger, networkId })

  // old governance modules
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

  const targetExtrinsicsSectionsMethods = {
    technicalCommittee: ['propose', 'vote'],
    democracy: ['vote', 'propose', 'second', 'removeVote', 'removeOtherVote', 'notePreimage'],
    council: ['propose', 'vote'],
    treasury: ['proposeSpend', 'reportAwesome', 'tip'],
    tips: ['tipNew', 'tip'],
    proxy: ['proxy'],
    multisig: ['asMulti'],
  }

  const targetEventsSectionsMethods = {
    technicalCommittee: ['Approved', 'Executed', 'Closed', 'Disapproved', 'MemberExecuted'],
    democracy: ['Started', 'Tabled', 'Cancelled', 'Executed', 'NotPassed', 'Passed', 'PreimageUsed'],
    council: ['Approved', 'Executed', 'Closed', 'Disapproved', 'MemberExecuted'],
    treasury: ['Rejected', 'Awarded', 'TipClosed'],
    tips: ['TipClosed'],
  }

  console.log('targetEventsSectionsMethods', targetEventsSectionsMethods)

  // get all target extrinsics
  const targetExtrinsicsMethodSections = Object.entries(targetExtrinsicsSectionsMethods).reduce((acc, [section, methods]) => {
    const extrinsics = methods.reduce((acc, method) => {
      acc.push({ section, method })
      return acc
    }, [] as { section: string; method: string }[])
    acc = [...acc, ...extrinsics]
    return acc
  }, [] as { section: string; method: string }[])

  console.log('targetExtrinsicsMethodSections', targetExtrinsicsMethodSections)

  const targetExtrinsics = await streamerProdRepository.extrinsics.findBySectionAndMethod(targetExtrinsicsMethodSections)

  console.log('targetExtrinsics', targetExtrinsics.length)

  // get all target events
  const targetEventsMethodSections = Object.entries(targetEventsSectionsMethods).reduce((acc, [section, methods]) => {
    const events = methods.reduce((acc, method) => {
      acc.push({ section, method })
      return acc
    }, [] as { section: string; method: string }[])
    acc = [...acc, ...events]
    return acc
  }, [] as { section: string; method: string }[])

  console.log('targetEventsMethodSections', targetEventsMethodSections)

  const targetEvents = await streamerProdRepository.events.findBySectionAndMethod(targetEventsMethodSections)
  console.log('targetEvents', targetEvents.length)

  const reducedBlockIds = [...targetExtrinsics, ...targetEvents]
    .reduce((acc, extrinsic) => {
      if (acc.includes(extrinsic.block_id)) return acc
      return [...acc, extrinsic.block_id]
    }, [] as number[])
    .map((id) => +id)
    .sort((a, b) => a - b)

  console.log('REDUCED LENGTH', reducedBlockIds.length)

  const chunks = []
  const chunk = 1000

  for (let i = 0, j = reducedBlockIds.length; i < j; i += chunk) {
    chunks.push(reducedBlockIds.slice(i, i + chunk))
  }

  reducedBlockIds.map((id, index) => console.log(index, id))

  let index = 0
  while (index < reducedBlockIds.length) {
    const blockId = reducedBlockIds[index]

    console.log(index, ': process block ', blockId)

    try {
      if (blockId > 6661795) await blockProcessor(blockId)
    } catch (error: any) {
      console.log('Error in debug loop: ' + error.message)
      throw error
    }

    index++
  }
}

main()

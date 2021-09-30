// import { MultisigExtrinsicProcessor } from './../../modules/governance/processors/multisigExtrinsics/index'
import { polkadotFactory } from './../common/infra/polkadotapi/index'
import { ExtrinsicProcessor } from '../../modules/governance/processors/extrinsics'
import { GovernanceProcessor } from '../../modules/governance'
import { LoggerFactory as PinoLogger } from '../common/infra/logger/logger'
import knex from 'knex'
import { GovernanceRepository } from '../common/infra/postgresql/governance/governance.repository'
import { KafkaListenerFactory } from 'apps/common/infra/kafka/governance/kafka-listener'

import { environment } from './environment'
import { EventProcessor } from '@modules/governance/processors/events'

const main = async () => {
  const logger = PinoLogger({ logLevel: environment.LOG_LEVEL! })

  console.log({ DB_SCHEMA: environment.DB_SCHEMA })
  const pg = knex({
    client: 'pg',
    debug: true,
    connection: {
      connectionString: environment.PG_CONNECTION_STRING,
      ssl: false,
    },
    searchPath: ['knex', environment.DB_SCHEMA!],
  })

  const polkadotApi = await polkadotFactory(environment.SUBSTRATE_URI!)

  const governanceRepository = GovernanceRepository({ knex: pg, logger })

  const extrinsicProcessor = ExtrinsicProcessor({ governanceRepository, logger, polkadotApi })
  const eventProcessor = EventProcessor({ governanceRepository, logger, polkadotApi })
  // const multisigExtrinsicProcessor = MultisigExtrinsicProcessor({ polkadotApi, logger })

  const governanceProcessor = GovernanceProcessor({ extrinsicProcessor, eventProcessor, /* multisigExtrinsicProcessor ,*/ logger })

  const kafka = KafkaListenerFactory(governanceProcessor, logger, environment)
  await kafka.listen()
}

main()

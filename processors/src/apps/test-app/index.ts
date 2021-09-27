import { EventsRepository } from './../common/infra/postgresql/governance/events.repository'
import { LoggerFactory as PinoLogger } from '../common/infra/logger/logger'
import knex from 'knex'

import { environment } from './environment'
import { ExtrinsicsRepository } from 'apps/common/infra/postgresql/governance/extrinsics.repository'
import axios from 'axios'

const main = async () => {
  const logger = PinoLogger({ logLevel: environment.LOG_LEVEL! })

  console.log({ DB_SCHEMA: environment.DB_SCHEMA })

  const DB_CONNECTION_STRING =
    'postgresql://app_streamer_polkadot:xDKd@t5_Cw0oXjw4Xv7y2Xm@r2_P1-5MjRcPdlKxPS@lNxRo_3@localhost:5435/mbelt_substrate_polkadot?schema=dot_kusama'
  const pg = knex({
    client: 'pg',
    debug: true,
    connection: {
      connectionString: DB_CONNECTION_STRING,
      ssl: false,
    },
    searchPath: ['knex', environment.DB_SCHEMA!],
  })

  const eventsRepository = EventsRepository({ knex: pg, logger })
  const extrinsicsRepository = ExtrinsicsRepository({ knex: pg, logger })

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

  // get all target extrinsics
  const targetExtrinsicsMethodSections = Object.entries(targetExtrinsicsSectionsMethods).reduce((acc, [section, methods]) => {
    const extrinsics = methods.reduce((acc, method) => {
      acc.push({ section, method })
      return acc
    }, [] as { section: string; method: string }[])
    acc = [...acc, ...extrinsics]
    return acc
  }, [] as { section: string; method: string }[])

  console.log(targetExtrinsicsMethodSections)

  const targetExtrinsics = await extrinsicsRepository.findBySectionAndMethod(targetExtrinsicsMethodSections)

  console.log('length', targetExtrinsics.length)

  const reducedBlockIds = targetExtrinsics.reduce((acc, extrinsic) => {
    if (acc.includes(extrinsic.block_id)) return acc
    return [...acc, extrinsic.block_id]
  }, [] as number[])

  for (const blockId of reducedBlockIds) {
    try {
      await axios.get('http://localhost:8080/api/blocks/update/' + blockId)
    } catch (error) {
      console.log(error)
    }
  }
}

main()

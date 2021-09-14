import { ApiPromise } from '@polkadot/api'
import { processDemocracyProposalTabled } from './democracy/proposal/tabled'
import { Logger } from 'apps/common/infra/logger/logger'
import { GovernanceRepository } from '../../../../apps/common/infra/postgresql/governance/governance.repository'
import { EventEntry } from '../../types'
import {
  processTechnicalCommitteeApprovedEvent,
  processTechnicalCommitteeDisapprovedEvent,
  processTechnicalCommitteeExecutedEvent,
  processTechnicalCommitteeMemberExecutedEvent,
} from './technicalCommittee'

import {
  processDemocracyReferendaCancelled,
  processDemocracyReferendaExecuted,
  processDemocracyReferendaNotPassed,
  processDemocracyReferendaPassed,
  processDemocracyReferendaStarted,
} from './democracy/referenda'
import { processTechnicalCommitteeClosedEvent } from './technicalCommittee/closed'
import { processDemocracyPreimageUsedEvent } from './democracy/premiage'

export type EventProcessor = ReturnType<typeof EventProcessor>

export const EventProcessor = (deps: { governanceRepository: GovernanceRepository; logger: Logger; polkadotApi: ApiPromise }) => {
  const { governanceRepository, logger, polkadotApi } = deps

  return {
    technicalCommittee: {
      approved: (event: EventEntry) => processTechnicalCommitteeApprovedEvent(event, governanceRepository, logger),
      closed: (event: EventEntry) => processTechnicalCommitteeClosedEvent(event, governanceRepository, logger),
      executed: (event: EventEntry) => processTechnicalCommitteeExecutedEvent(event, governanceRepository, logger),
      disapproved: (event: EventEntry) => processTechnicalCommitteeDisapprovedEvent(event, governanceRepository, logger),
      memberExecuted: (event: EventEntry) => processTechnicalCommitteeMemberExecutedEvent(event, governanceRepository, logger),
    },
    democracy: {
      referenda: {
        started: (event: EventEntry) => processDemocracyReferendaStarted(event, governanceRepository, logger, polkadotApi),
        cancelled: (event: EventEntry) => processDemocracyReferendaCancelled(event, governanceRepository, logger),
        executed: (event: EventEntry) => processDemocracyReferendaExecuted(event, governanceRepository, logger),
        notpassed: (event: EventEntry) => processDemocracyReferendaNotPassed(event, governanceRepository, logger),
        passed: (event: EventEntry) => processDemocracyReferendaPassed(event, governanceRepository, logger),
      },
      proposal: {
        tabled: (event: EventEntry) => processDemocracyProposalTabled(event, governanceRepository, logger, polkadotApi),
      },
      preimage: {
        used: (event: EventEntry) => processDemocracyPreimageUsedEvent(event, governanceRepository, logger),
      },
    },
  }
}

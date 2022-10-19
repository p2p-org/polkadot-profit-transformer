import { processTipsClosedEvent } from './treasury/tips/tipclosed'
import { ApiPromise } from '@polkadot/api'
import { processDemocracyProposalTabled } from './democracy/proposal/tabled'
import { Logger } from 'loaders/logger'
import {
  processTechnicalCommitteeApprovedEvent,
  processTechnicalCommitteeDisapprovedEvent,
  processTechnicalCommitteeExecutedEvent,
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
import {
  processCouncilApprovedEvent,
  processCouncilDisapprovedEvent,
  processCouncilExecutedEvent,
  processCouncilMemberExecutedEvent,
} from './democracy/council'
import { processCouncilClosedEvent } from './democracy/council/closed'
import { processTreasuryRejectedEvent } from './treasury/proposal/rejected'
import { processTreasuryAwardedEvent } from './treasury/proposal/awarded'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { EventModel } from '@/models/event.model'

export type EventProcessor = ReturnType<typeof EventProcessor>

export const EventProcessor = (deps: { governanceRepository: GovernanceRepository; logger: Logger; polkadotApi: ApiPromise }) => {
  const { governanceRepository, logger, polkadotApi } = deps

  return {
    technicalCommittee: {
      approved: (event: EventModel) => processTechnicalCommitteeApprovedEvent(event, governanceRepository, logger),
      closed: (event: EventModel) => processTechnicalCommitteeClosedEvent(event, governanceRepository, logger),
      executed: (event: EventModel) => processTechnicalCommitteeExecutedEvent(event, governanceRepository, logger),
      disapproved: (event: EventModel) => processTechnicalCommitteeDisapprovedEvent(event, governanceRepository, logger),
    },
    democracy: {
      referenda: {
        started: (event: EventModel) => processDemocracyReferendaStarted(event, governanceRepository, logger, polkadotApi),
        cancelled: (event: EventModel) => processDemocracyReferendaCancelled(event, governanceRepository, logger),
        executed: (event: EventModel) => processDemocracyReferendaExecuted(event, governanceRepository, logger),
        notpassed: (event: EventModel) => processDemocracyReferendaNotPassed(event, governanceRepository, logger),
        passed: (event: EventModel) => processDemocracyReferendaPassed(event, governanceRepository, logger),
      },
      proposal: {
        tabled: (event: EventModel) => processDemocracyProposalTabled(event, governanceRepository, logger, polkadotApi),
      },
      preimage: {
        used: (event: EventModel) => processDemocracyPreimageUsedEvent(event, governanceRepository, logger),
      },
    },
    council: {
      approved: (event: EventModel) => processCouncilApprovedEvent(event, governanceRepository, logger),
      closed: (event: EventModel) => processCouncilClosedEvent(event, governanceRepository, logger),
      executed: (event: EventModel) => processCouncilExecutedEvent(event, governanceRepository, logger),
      disapproved: (event: EventModel) => processCouncilDisapprovedEvent(event, governanceRepository, logger),
      memberExecuted: (event: EventModel) => processCouncilMemberExecutedEvent(event, governanceRepository, logger),
    },
    treasury: {
      proposal: {
        rejected: (event: EventModel) => processTreasuryRejectedEvent(event, governanceRepository, logger),
        awarded: (event: EventModel) => processTreasuryAwardedEvent(event, governanceRepository, logger),
      },
      tips: {
        tipsclosed: (event: EventModel) => processTipsClosedEvent(event, governanceRepository, logger),
      },
    },
  }
}

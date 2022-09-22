import { ApiPromise } from '@polkadot/api'
import { Logger } from 'loaders/logger'
import {
  processDemocracyReferendaRemoveOtherVoteExtrinsic,
  processDemocracyReferendaRemoveVoteExtrinsic,
  processDemocracyReferendaVoteExtrinsic,
} from './democracy/referenda'
import { processTechnicalCommiteeProposeExtrinsic, processTechnicalCommiteeVoteExtrinsic } from './technicalCommitee'
import { processDemocracyProposalProposeExtrinsic } from './democracy/proposal'
import { processDemocracyProposalSecondExtrinsic } from './democracy/proposal/second'
import { processDemocracyNotePreimageExtrinsic } from './democracy/preimage'
import { EventRecord } from '@polkadot/types/interfaces'
import { processCouncilProposeExtrinsic } from './council/propose'
import { processCouncilProposalVoteExtrinsic } from './council/vote'
import { processTreasuryProposeSpendExtrinsic } from './treasury/proposal/propose-spend'
import { processTreasuryTipsNewExtrinsic } from './treasury/tips/tip-new'
import { processTreasuryReportAwesomeExtrinsic } from './treasury/tips/report-awesome'
import { processTreasuryTipExtrinsic } from './treasury/tips/tip'
import { ExtrinsicModel } from 'apps/common/infra/postgresql/models/extrinsic.model'
import { BlockModel } from 'apps/common/infra/postgresql/models/block.model'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'

export type ExtrincicProcessorInput = {
  extrinsic: ExtrinsicModel
  block: BlockModel
  events: EventRecord[]
}

export type ExtrinsicProcessor = ReturnType<typeof ExtrinsicProcessor>

export const ExtrinsicProcessor = (deps: { logger: Logger; polkadotApi: ApiPromise }) => {
  const { logger, polkadotApi } = deps

  return {
    technicalCommitee: {
      propose: (args: ExtrincicProcessorInput) => processTechnicalCommiteeProposeExtrinsic(args, governanceRepository, logger),
      vote: (args: ExtrincicProcessorInput) => processTechnicalCommiteeVoteExtrinsic(args, governanceRepository, logger),
    },
    democracy: {
      referenda: {
        vote: (args: ExtrincicProcessorInput) => processDemocracyReferendaVoteExtrinsic(args, governanceRepository, logger),
        removeVote: (args: ExtrincicProcessorInput) =>
          processDemocracyReferendaRemoveVoteExtrinsic(args, governanceRepository, logger),
        removeOtherVote: (args: ExtrincicProcessorInput) =>
          processDemocracyReferendaRemoveOtherVoteExtrinsic(args, governanceRepository, logger),
      },
      proposal: {
        propose: (args: ExtrincicProcessorInput) => processDemocracyProposalProposeExtrinsic(args, governanceRepository, logger),
        second: (args: ExtrincicProcessorInput) => processDemocracyProposalSecondExtrinsic(args, governanceRepository, logger),
      },
      preimage: {
        notePreimage: (args: ExtrincicProcessorInput) =>
          processDemocracyNotePreimageExtrinsic(args, governanceRepository, logger, polkadotApi),
      },
    },
    council: {
      propose: (args: ExtrincicProcessorInput) => processCouncilProposeExtrinsic(args, governanceRepository, logger),
      vote: (args: ExtrincicProcessorInput) => processCouncilProposalVoteExtrinsic(args, governanceRepository, logger),
    },
    treasury: {
      propose: (args: ExtrincicProcessorInput) => processTreasuryProposeSpendExtrinsic(args, governanceRepository, logger),
    },
    tips: {
      tipNew: (args: ExtrincicProcessorInput) => processTreasuryTipsNewExtrinsic(args, governanceRepository, logger),
      reportAwesome: (args: ExtrincicProcessorInput) => processTreasuryReportAwesomeExtrinsic(args, governanceRepository, logger),
      tip: (args: ExtrincicProcessorInput) => processTreasuryTipExtrinsic(args, governanceRepository, logger),
    },
  }
}

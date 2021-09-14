import { ApiPromise } from '@polkadot/api'
import { Extrinsic } from './../../types'
import { Logger } from 'apps/common/infra/logger/logger'
import { GovernanceRepository } from '../../../../apps/common/infra/postgresql/governance/governance.repository'
import {
  processDemocracyReferendaRemoveOtherVoteExtrinsic,
  processDemocracyReferendaRemoveVoteExtrinsic,
  processDemocracyReferendaVoteExtrinsic,
} from './democracy/referenda'
import { processTechnicalCommiteeProposeExtrinsic, processTechnicalCommiteeVoteExtrinsic } from './technicalCommitee'
import { processDemocracyProposalProposeExtrinsic } from './democracy/proposal'
import { processDemocracyProposalSecondExtrinsic } from './democracy/proposal/second'
import { processDemocracyNotePreimageExtrinsic } from './democracy/preimage'

export type ExtrinsicProcessor = ReturnType<typeof ExtrinsicProcessor>

export const ExtrinsicProcessor = (deps: { governanceRepository: GovernanceRepository; logger: Logger; polkadotApi: ApiPromise }) => {
  const { governanceRepository, logger, polkadotApi } = deps

  return {
    technicalCommitee: {
      propose: (extrinsic: Extrinsic) => processTechnicalCommiteeProposeExtrinsic(extrinsic, governanceRepository, logger, polkadotApi),
      vote: (extrinsic: Extrinsic) => processTechnicalCommiteeVoteExtrinsic(extrinsic, governanceRepository, logger, polkadotApi),
    },
    democracy: {
      referenda: {
        vote: (extrinsic: Extrinsic) => processDemocracyReferendaVoteExtrinsic(extrinsic, governanceRepository, logger, polkadotApi),
        removeVote: (extrinsic: Extrinsic) =>
          processDemocracyReferendaRemoveVoteExtrinsic(extrinsic, governanceRepository, logger, polkadotApi),
        removeOtherVote: (extrinsic: Extrinsic) =>
          processDemocracyReferendaRemoveOtherVoteExtrinsic(extrinsic, governanceRepository, logger, polkadotApi),
      },
      proposal: {
        propose: (extrinsic: Extrinsic) => processDemocracyProposalProposeExtrinsic(extrinsic, governanceRepository, logger, polkadotApi),
        second: (extrinsic: Extrinsic) => processDemocracyProposalSecondExtrinsic(extrinsic, governanceRepository, logger, polkadotApi),
      },
      preimage: {
        notePreimage: (extrinsic: Extrinsic) => processDemocracyNotePreimageExtrinsic(extrinsic, governanceRepository, logger, polkadotApi),
      },
    },
  }
}

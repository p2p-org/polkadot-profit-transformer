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
import { isExtrinsicSuccess } from '../utils/isExtrinsicSuccess'
import { findExtrinic } from '../utils/findExtrinsic'
import { GenericExtrinsic, Vec } from '@polkadot/types'
import { EventRecord } from '@polkadot/types/interfaces'
import { AnyTuple } from '@polkadot/types/types'

export type ExtrincicProcessorInput = {
  extrinsic: Extrinsic
  extrinsicFull: GenericExtrinsic<AnyTuple>
  blockEvents: Vec<EventRecord>
}

export type ExtrinsicProcessor = ReturnType<typeof ExtrinsicProcessor>

export const ExtrinsicProcessor = (deps: { governanceRepository: GovernanceRepository; logger: Logger; polkadotApi: ApiPromise }) => {
  const { governanceRepository, logger, polkadotApi } = deps

  return {
    technicalCommitee: {
      propose: (args: ExtrincicProcessorInput) => processTechnicalCommiteeProposeExtrinsic(args, governanceRepository, logger),
      vote: (args: ExtrincicProcessorInput) => processTechnicalCommiteeVoteExtrinsic(args, governanceRepository, logger),
    },
    democracy: {
      referenda: {
        vote: (args: ExtrincicProcessorInput) => processDemocracyReferendaVoteExtrinsic(args, governanceRepository, logger),
        removeVote: (args: ExtrincicProcessorInput) => processDemocracyReferendaRemoveVoteExtrinsic(args, governanceRepository, logger),
        removeOtherVote: (args: ExtrincicProcessorInput) =>
          processDemocracyReferendaRemoveOtherVoteExtrinsic(args, governanceRepository, logger),
      },
      proposal: {
        propose: (args: ExtrincicProcessorInput) => processDemocracyProposalProposeExtrinsic(args, governanceRepository, logger),
        second: (args: ExtrincicProcessorInput) => processDemocracyProposalSecondExtrinsic(args, governanceRepository, logger),
      },
      preimage: {
        notePreimage: (args: ExtrincicProcessorInput) => processDemocracyNotePreimageExtrinsic(args, governanceRepository, logger),
      },
    },
    utils: {
      isExtrinsicSuccessfull: async (extrinsic: Extrinsic): Promise<boolean> => {
        const blockHash = await polkadotApi.rpc.chain.getBlockHash(extrinsic.block_id)
        const blockEvents = await polkadotApi.query.system.events.at(blockHash)
        const isExtrinsicSuccessfull = await isExtrinsicSuccess(extrinsic, blockEvents, polkadotApi)
        return isExtrinsicSuccessfull
      },
      getFullBlockData: async (
        extrinsic: Extrinsic,
      ): Promise<{ blockEvents: Vec<EventRecord>; extrinsicFull: GenericExtrinsic<AnyTuple> | undefined }> => {
        const blockHash = await polkadotApi.rpc.chain.getBlockHash(extrinsic.block_id)
        const blockEvents = await polkadotApi.query.system.events.at(blockHash)
        const block = await polkadotApi.rpc.chain.getBlock(blockHash)
        const extrinsicFull = await findExtrinic(block, extrinsic.section, extrinsic.method, polkadotApi)

        return { blockEvents, extrinsicFull }
      },
    },
  }
}

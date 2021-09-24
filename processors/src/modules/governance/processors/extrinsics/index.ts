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
import { GenericExtrinsic } from '@polkadot/types'
import { EventRecord, SignedBlock } from '@polkadot/types/interfaces'
import { AnyTuple } from '@polkadot/types/types'
import { processCouncilProposeExtrinsic } from './council/propose'
import { processCouncilProposalVoteExtrinsic } from './council/vote'
import { processTreasuryProposeSpendExtrinsic } from './treasury/proposal/propose-spend'
import { processTreasuryTipsNewExtrinsic } from './treasury/tips/tip-new'
import { processTreasuryReportAwesomeExtrinsic } from './treasury/tips/report-awesome'
import { processTreasuryTipExtrinsic } from './treasury/tips/tip'
import { extrinsics } from '@polkadot/types/interfaces/definitions'

export type ExtrincicProcessorInput = {
  extrinsic: Extrinsic
  fullExtrinsic: GenericExtrinsic<AnyTuple>
  extrinsicEvents: EventRecord[]
  block: SignedBlock
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
        notePreimage: (args: ExtrincicProcessorInput) =>
          processDemocracyNotePreimageExtrinsic(args, governanceRepository, logger, polkadotApi),
      },
    },
    council: {
      propose: (args: ExtrincicProcessorInput) => processCouncilProposeExtrinsic(args, governanceRepository, logger, polkadotApi),
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
    utils: {
      isExtrinsicSuccessfull: async (extrinsic: Extrinsic): Promise<boolean> => {
        const blockHash = await polkadotApi.rpc.chain.getBlockHash(extrinsic.block_id)
        const blockEvents = await polkadotApi.query.system.events.at(blockHash)
        const isExtrinsicSuccessfull = await isExtrinsicSuccess(extrinsic, blockEvents, polkadotApi)
        return isExtrinsicSuccessfull
      },
      getExtrinsic: async (extrinsic: Extrinsic): Promise<GenericExtrinsic<AnyTuple>> => {
        const blockHash = await polkadotApi.rpc.chain.getBlockHash(extrinsic.block_id)
        const block = await polkadotApi.rpc.chain.getBlock(blockHash)

        // find full extrinsic and mapped events

        const extrinsicIndex = +extrinsic.id.split('-')[1]
        const fullExtrinsic = block.block.extrinsics[extrinsicIndex]

        // here we decode proxy.proxy extrinsic and create fake extrinsic with data called via proxy
        if (fullExtrinsic.method.method === 'proxy' && fullExtrinsic.method.section === 'proxy') {
          const e = polkadotApi.createType<GenericExtrinsic<AnyTuple>>('GenericExtrinsic', fullExtrinsic.args[2])

          console.log('method section', e.method.method, e.method.section)
          return e
        }

        return fullExtrinsic
      },
      getActionData: async (extrinsic: Extrinsic): Promise<{ extrinsicEvents: EventRecord[]; block: SignedBlock }> => {
        const blockHash = await polkadotApi.rpc.chain.getBlockHash(extrinsic.block_id)
        const blockEvents = await polkadotApi.query.system.events.at(blockHash)
        const block = await polkadotApi.rpc.chain.getBlock(blockHash)

        // find mapped events

        const extrinsicIndex = +extrinsic.id.split('-')[1]
        const fullExtrinsic = block.block.extrinsics[extrinsicIndex]

        if (!fullExtrinsic) throw Error('no full extrinsic found for db extrinsic ' + extrinsic.id)

        const extrinsicEvents = blockEvents.filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(extrinsicIndex))

        return { extrinsicEvents, block }
      },
      extractProxy: async (extrinsic: Extrinsic) => {
        console.log('extract proxy', extrinsic)
      },
    },
  }
}

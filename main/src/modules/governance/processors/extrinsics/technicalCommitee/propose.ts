import { TechnicalCommiteeProposalModel } from '../../../../../apps/common/infra/postgresql/governance/models/technicalCommiteeModel'
import { GovernanceRepository } from './../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { findEvent } from '../../utils/findEvent'
import { AccountId, Hash, MemberCount, Proposal, ProposalIndex } from '@polkadot/types/interfaces'
import { ExtrincicProcessorInput } from '..'
import { Compact } from '@polkadot/types'

export const processTechnicalCommiteeProposeExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { extrinsicEvents, fullExtrinsic, extrinsic } = args
  logger.info({ extrinsic }, 'processTechnicalCommiteeProposeExtrinsic')

  const threshold = (<Compact<MemberCount>>fullExtrinsic.args[0]).toNumber()
  const proposalArg = <Proposal>fullExtrinsic.method.args[1]

  const proposal = {
    call_module: proposalArg.section,
    call_name: proposalArg.method,
    ...proposalArg.toJSON(),
  }

  // threshold more than 1, will be voting
  if (threshold > 1) {
    const techCommProposedEvent = findEvent(extrinsicEvents, 'technicalCommittee', 'Proposed')
    if (!techCommProposedEvent) throw Error('no technicalcommittee Proposed event for enrty ' + extrinsic.id)

    const proposer = <AccountId>techCommProposedEvent.event.data[0]
    const proposalIndex = <ProposalIndex>techCommProposedEvent.event.data[1]
    const proposalHash = <Hash>techCommProposedEvent.event.data[2]

    const proposalModel: TechnicalCommiteeProposalModel = {
      id: proposalIndex.toNumber(),
      hash: proposalHash.toString(),
      block_id: extrinsic.block_id,
      event: 'Proposed',
      data: {
        proposer,
        threshold: threshold,
        proposal: proposal,
      },
      extrinsic_id: extrinsic.id,
      event_id: 'propose',
    }

    console.log({ proposalModel })

    await governanceRepository.technicalCommittee.save(proposalModel)
    return
  }

  // threshold less than 2, immediate execution
  const techCommExexcutedEvent = findEvent(extrinsicEvents, 'technicalCommittee', 'Executed')
  if (!techCommExexcutedEvent) throw Error('no technicalcommittee executed event for enrty ' + extrinsic.id)

  const hash = <Hash>techCommExexcutedEvent.event.data[0]

  const proposalModel: TechnicalCommiteeProposalModel = {
    id: null,
    hash: hash.toString(),
    block_id: extrinsic.block_id,
    event: 'Proposed',
    data: {
      proposer: fullExtrinsic.signer.toString(),
      threshold: threshold,
      proposal: proposal,
    },
    extrinsic_id: extrinsic.id,
    event_id: 'propose',
  }

  // const proposalExecutedModel: TechnicalCommiteeProposalModel = {
  //   id: null,
  //   hash: hash.toString(),
  //   block_id: extrinsic.block_id,
  //   event: 'Executed',
  //   data: {
  //     result: result.toJSON(),
  //   },
  //   extrinsic_id: extrinsic.id,
  //   event_id: 'executed',
  // }

  await governanceRepository.technicalCommittee.save(proposalModel)
  // await governanceRepository.technicalCommittee.save(proposalExecutedModel)
}

import { findEvent } from '@modules/governance-processor/processors/utils/findEvent'
import { Logger } from 'apps/common/infra/logger/logger'
import { AccountId, Hash, MemberCount, Proposal, ProposalIndex } from '@polkadot/types/interfaces'
import { ExtrincicProcessorInput } from '..'
import { Compact } from '@polkadot/types'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { TechnicalCommiteeProposalModel } from 'apps/common/infra/postgresql/models/technicalCommittee.model'

export const processTechnicalCommiteeProposeExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { events, extrinsic } = args
  logger.info({ extrinsic }, 'processTechnicalCommiteeProposeExtrinsic')

  console.log('extrinsic.args[0]', extrinsic.args)

  const threshold = (<Compact<MemberCount>>extrinsic.args[0]).toNumber()
  const proposalArg = <Proposal>extrinsic.args[1]

  const proposal = {
    call_module: proposalArg.section,
    call_name: proposalArg.method,
    ...proposalArg.toJSON(),
  }

  // threshold more than 1, will be voting
  if (threshold > 1) {
    const techCommProposedEvent = findEvent(events, 'technicalCommittee', 'Proposed')
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
  const techCommExexcutedEvent = findEvent(events, 'technicalCommittee', 'Executed')
  if (!techCommExexcutedEvent) throw Error('no technicalcommittee executed event for enrty ' + extrinsic.id)

  const hash = <Hash>techCommExexcutedEvent.event.data[0]

  const proposalModel: TechnicalCommiteeProposalModel = {
    id: null,
    hash: hash.toString(),
    block_id: extrinsic.block_id,
    event: 'Proposed',
    data: {
      proposer: extrinsic.signer,
      threshold: threshold,
      proposal: proposal,
    },
    extrinsic_id: extrinsic.id,
    event_id: 'propose',
  }

  await governanceRepository.technicalCommittee.save(proposalModel)
}

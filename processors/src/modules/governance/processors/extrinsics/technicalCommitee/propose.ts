import { TechnicalCommiteeProposalModel } from '../../../../../apps/common/infra/postgresql/governance/models/technicalCommiteeModels'
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

  const techCommProposedEvent = findEvent(extrinsicEvents, 'technicalCommittee', 'Proposed')
  if (!techCommProposedEvent) throw Error('no technicalcommittee Proposed event for enrty ' + extrinsic.id)

  const proposer = <AccountId>techCommProposedEvent.event.data[0]
  const proposalIndex = <ProposalIndex>techCommProposedEvent.event.data[1]
  const proposalHash = <Hash>techCommProposedEvent.event.data[2]
  const threshold = <Compact<MemberCount>>fullExtrinsic.args[0]
  const proposal = <Proposal>fullExtrinsic.args[1]

  const proposalModel: TechnicalCommiteeProposalModel = {
    id: proposalIndex.toNumber(),
    hash: proposalHash.toString(),
    block_id: extrinsic.block_id,
    event: 'Proposed',
    data: {
      proposer,
      threshold: parseInt(threshold.toHex(), 16),
      proposal: proposal,
    },
    extrinsic_id: extrinsic.id,
    event_id: 'propose',
  }

  console.log({ proposalModel })

  await governanceRepository.technicalCommittee.save(proposalModel)
}

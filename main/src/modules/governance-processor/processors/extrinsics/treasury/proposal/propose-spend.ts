// import { TechnicalCommiteeProposalModel } from '../../../../../apps/common/infra/postgresql/governance/models/technicalCommiteeModels'
import { Logger } from 'apps/common/infra/logger/logger'
import { MultiAddress, ProposalIndex } from '@polkadot/types/interfaces'
import { Compact, u128 } from '@polkadot/types'
import { findEvent } from '@modules/governance-processor/processors/utils/findEvent'
import { ExtrincicProcessorInput } from '../..'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { TreasuryProposalModel } from 'apps/common/infra/postgresql/models/treasuryProposal.model'

export const processTreasuryProposeSpendExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { events, extrinsic } = args
  logger.info({ extrinsic }, 'processTreasuryProposeSpendExtrinsic')

  const treasuryProposeSpendEvent = findEvent(events, 'treasury', 'Proposed')
  if (!treasuryProposeSpendEvent) throw Error('no treasury propose event for enrty ' + extrinsic.id)

  const proposalIndex = <ProposalIndex>treasuryProposeSpendEvent.event.data[0]
  const value = <Compact<u128>>extrinsic.args[0]
  const beneficiary = <MultiAddress>extrinsic.args[1]

  const proposalModel: TreasuryProposalModel = {
    id: proposalIndex.toNumber(),
    block_id: extrinsic.block_id,
    event: 'Proposed',
    data: {
      proposer: extrinsic.signer,
      beneficiary,
      value,
    },
    extrinsic_id: extrinsic.id,
    event_id: 'proposed',
  }

  console.log({ proposalModel })

  await governanceRepository.treasury.proposal.save(proposalModel)
}

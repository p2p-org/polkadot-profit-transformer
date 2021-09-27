// import { TechnicalCommiteeProposalModel } from '../../../../../apps/common/infra/postgresql/governance/models/technicalCommiteeModels'
import { Logger } from 'apps/common/infra/logger/logger'
import { MultiAddress, ProposalIndex } from '@polkadot/types/interfaces'
import { Compact, u128 } from '@polkadot/types'
import { TreasuryProposalModel } from 'apps/common/infra/postgresql/governance/models/treasuryProposalModel'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance/governance.repository'
import { findEvent } from '@modules/governance/processors/utils/findEvent'
import { ExtrincicProcessorInput } from '../..'

export const processTreasuryProposeSpendExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { extrinsicEvents, fullExtrinsic, extrinsic } = args
  logger.info({ extrinsic }, 'processTreasuryProposeSpendExtrinsic')

  console.log('fullExtrinsic', fullExtrinsic.toHuman())

  const treasuryProposeSpendEvent = findEvent(extrinsicEvents, 'treasury', 'Proposed')
  if (!treasuryProposeSpendEvent) throw Error('no treasury propose event for enrty ' + extrinsic.id)

  const proposalIndex = <ProposalIndex>treasuryProposeSpendEvent.event.data[0]
  const value = <Compact<u128>>fullExtrinsic.args[0]
  const beneficiary = <MultiAddress>fullExtrinsic.args[1]

  const proposalModel: TreasuryProposalModel = {
    id: proposalIndex.toNumber(),
    block_id: extrinsic.block_id,
    event: 'Proposed',
    data: {
      proposer: fullExtrinsic.signer.toString(),
      beneficiary,
      value,
    },
    extrinsic_id: extrinsic.id,
    event_id: 'proposed',
  }

  console.log({ proposalModel })

  await governanceRepository.treasury.proposal.save(proposalModel)
}

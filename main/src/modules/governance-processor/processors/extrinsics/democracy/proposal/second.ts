import { DemocracyProposalModel } from '../../../../../../apps/common/infra/postgresql/governance/models/democracy.model'
import { GovernanceRepository } from '../../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { ExtrincicProcessorInput } from '../..'
import { Compact, u32 } from '@polkadot/types'

export const processDemocracyProposalSecondExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { fullExtrinsic, extrinsic } = args

  logger.info('democracy.second extrinsic', extrinsic.id)

  const proposalId = <Compact<u32>>fullExtrinsic.args[0]
  const seconds_upper_bound = <Compact<u32>>fullExtrinsic.args[1]

  const proposal: DemocracyProposalModel = {
    id: proposalId.toNumber(),
    hash: '',
    block_id: extrinsic.block_id,
    event_id: '',
    extrinsic_id: extrinsic.id,
    event: 'Second',
    data: { signer: extrinsic.signer, seconds_upper_bound },
  }

  await governanceRepository.democracy.proposal.save(proposal)
}

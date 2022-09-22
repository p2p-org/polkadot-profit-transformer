import { Logger } from 'loaders/logger'
import { ExtrincicProcessorInput } from '../..'
import { Compact, u32 } from '@polkadot/types'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { DemocracyProposalModel } from 'apps/common/infra/postgresql/models/democracy.model'

export const processDemocracyProposalSecondExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { extrinsic } = args

  logger.info('democracy.second extrinsic', extrinsic.id)

  const proposalId = (<Compact<u32>>extrinsic.args[0]).toNumber()
  const seconds_upper_bound = <Compact<u32>>extrinsic.args[1]

  const proposal: DemocracyProposalModel = {
    id: proposalId,
    hash: '',
    block_id: extrinsic.block_id,
    event_id: '',
    extrinsic_id: extrinsic.id,
    event: 'Second',
    data: { signer: extrinsic.signer, seconds_upper_bound },
  }

  await governanceRepository.democracy.proposal.save(proposal)
}

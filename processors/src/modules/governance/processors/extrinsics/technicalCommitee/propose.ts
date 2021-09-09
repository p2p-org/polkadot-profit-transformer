import { PreimageModel } from '../../../../../apps/common/infra/postgresql/governance/models/technicalCommiteeModels'
import { Extrinsic } from './../../../types'
import { GovernanceRepository } from './../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'

export const processTechnicalCommiteeProposeExtrinsic = (
  extrinsic: Extrinsic,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  // here preimage proposal_hash appears first time, add record to the proposal_image table

  console.log('proposal extrinsic')
  console.log({ extrinsic })

  logger.info({ extrinsic }, 'processTechnicalCommiteeProposeExtrinsic')

  const preimage: PreimageModel = {
    hash: extrinsic.args[1].args.proposal_hash,
    block_id: extrinsic.block_id,
    event_id: '',
    extrinsic_id: extrinsic.id,
    event: 'propose',
    data: extrinsic.extrinsic,
  }
  logger.info({ preimage }, 'preimage to save in DB')

  return governanceRepository.preimages.save(preimage)
}

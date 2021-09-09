import { DemocracyReferendaModel } from '../../../../../../apps/common/infra/postgresql/governance/models/democracyModels'
import { Extrinsic } from '../../../../types'
import { GovernanceRepository } from '../../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'

export const processDemocracyReferendaVoteExtrinsic = async (
  extrinsic: Extrinsic,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  // here preimage proposal_hash appears first time, add record to the proposal_image table

  console.log({ extrinsic })

  logger.info({ extrinsic }, 'processDemocracyReferendaVoteExtrinsic')

  // this.api!.rpc.chain.getBlockHash(height)
  //   this.api!.rpc.chain.getBlock(blockHash),

  const referendumIndex = extrinsic.args[0]
  const vote = parseInt(extrinsic.args[1], 16)

  console.log('VOTEEEEEE', { vote })

  const referenda: DemocracyReferendaModel = {
    id: referendumIndex,
    block_id: extrinsic.block_id,
    event_id: '',
    extrinsic_id: extrinsic.id,
    event: 'Voted',
    data: {
      sender: extrinsic.signer,
      vote: vote === 128 ? 'Aye' : 'Nay',
    },
  }

  return governanceRepository.democracy.referenda.save(referenda)
}

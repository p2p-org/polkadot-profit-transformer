import { ApiPromise } from '@polkadot/api'
import { DemocracyReferendaModel } from '../../../../../../apps/common/infra/postgresql/governance/models/democracyModels'
import { Extrinsic } from '../../../../types'
import { GovernanceRepository } from '../../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'

export const processDemocracyProposalProposeExtrinsic = async (
  extrinsic: Extrinsic,
  governanceRepository: GovernanceRepository,
  logger: Logger,
  polkadotApi: ApiPromise,
): Promise<void> => {
  console.log('PROPOSAL PROPOSE')
  console.log('EXTRINSIC ARGS', JSON.stringify(extrinsic.extrinsic.method, null, 2))

  const blockHash = await polkadotApi.rpc.chain.getBlockHash(extrinsic.block_id)
  const signedBlock = await polkadotApi.rpc.chain.getBlock(blockHash)
  const allRecords = await polkadotApi.query.system.events.at(blockHash)

  signedBlock.block.extrinsics.forEach(({ method: { method, section } }, index) => {
    // filter the specific events based on the phase and then the
    // index of our extrinsic in the block
    const events = allRecords
      .filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index))
      .map(({ event }) => `${event.section}.${event.method}.${event.index}`)

    console.log(`${section}.${method}:: ${events.join(', ') || 'no events'}`)
  })
}

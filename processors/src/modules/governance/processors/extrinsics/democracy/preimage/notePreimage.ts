import { DemocracyProposalModel } from './../../../../../../apps/common/infra/postgresql/governance/models/democracyModels'
import { ApiPromise } from '@polkadot/api'
import { Extrinsic } from '../../../../types'
import { GovernanceRepository } from '../../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { AccountId, Balance, EventRecord, Hash } from '@polkadot/types/interfaces'
import { GenericEventData } from '@polkadot/types/generic'
import { Bytes } from '@polkadot/types'
import { isExtrinsicSuccess } from '../../../utils/isExtrinsicSuccess'
import { findExtrinic } from '../../../utils/findExtrinsic'
import { findEvent } from '../../../utils/findEvent'
import { PreimageModel } from 'apps/common/infra/postgresql/governance/models/preimageModel'

export const processDemocracyNotePreimageExtrinsic = async (
  extrinsic: Extrinsic,
  governanceRepository: GovernanceRepository,
  logger: Logger,
  polkadotApi: ApiPromise,
): Promise<void> => {
  const blockHash = await polkadotApi.rpc.chain.getBlockHash(extrinsic.block_id)

  const blockEvents = await polkadotApi.query.system.events.at(blockHash)

  const isExtrinsicSuccessfull = await isExtrinsicSuccess(extrinsic, blockEvents, polkadotApi)
  if (!isExtrinsicSuccessfull) return

  const block = await polkadotApi.rpc.chain.getBlock(blockHash)

  const extrinsicFull = await findExtrinic(block, 'democracy', 'notePreimage', polkadotApi)
  if (!extrinsicFull) throw Error('no full extrinsic for enrty ' + extrinsic.id)

  const preimageNotedEvent = findEvent(blockEvents, 'democracy', 'PreimageNoted')
  if (!preimageNotedEvent) throw Error('no technicalcomdemocracymittee PreimageNoted event for enrty ' + extrinsic.id)

  const encoded_proposal = <Bytes>extrinsicFull.args[0]

  const proposalHash = <Hash>preimageNotedEvent.event.data[0]
  const accountId = <AccountId>preimageNotedEvent.event.data[1]
  const deposit = <Balance>preimageNotedEvent.event.data[2]

  const preimageRecord: PreimageModel = {
    proposal_hash: proposalHash.toString(),
    block_id: extrinsic.block_id,
    event_id: 'noted',
    extrinsic_id: extrinsic.id,
    event: 'preimageNoted',
    data: { deposit: deposit.toNumber(), accountId, encoded_proposal },
  }

  await governanceRepository.preimages.save(preimageRecord)
}

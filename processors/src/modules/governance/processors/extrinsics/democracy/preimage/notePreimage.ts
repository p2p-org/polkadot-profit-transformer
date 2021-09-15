import { DemocracyProposalModel } from './../../../../../../apps/common/infra/postgresql/governance/models/democracyModels'
import { ApiPromise } from '@polkadot/api'
import { Extrinsic } from '../../../../types'
import { GovernanceRepository } from '../../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { AccountId, Balance, Hash } from '@polkadot/types/interfaces'
import { Bytes } from '@polkadot/types'
import { findEvent } from '../../../utils/findEvent'
import { PreimageModel } from 'apps/common/infra/postgresql/governance/models/preimageModel'
import { ExtrincicProcessorInput } from '../..'

export const processDemocracyNotePreimageExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { blockEvents, extrinsicFull, extrinsic } = args

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

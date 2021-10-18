import { u128 } from '@polkadot/types'
import { AccountId32, H256 } from '@polkadot/types/interfaces'
import { Logger } from 'apps/common/infra/logger/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { EventModel } from 'apps/common/infra/postgresql/models/event.model'
import { PreimageModel } from 'apps/common/infra/postgresql/models/preimage.model'

type NewType = EventModel

export const processDemocracyPreimageUsedEvent = async (
  event: NewType,
  governanceRepository: GovernanceRepository,
  logger: Logger,
) => {
  const eventData = event.event.data

  const hash = (<H256>eventData[0]).toString()
  const accountId = (<AccountId32>eventData[1]).toString()
  const balance = (<u128>eventData[2]).toString()

  const preimageRecord: PreimageModel = {
    proposal_hash: hash,
    block_id: event.block_id,
    event_id: event.id,
    extrinsic_id: '',
    event: 'preimageUsed',
    data: { accountId, balance },
  }

  await governanceRepository.preimages.save(preimageRecord)
}

import { EventEntry } from '@modules/governance-processor/types'
import { Logger } from 'apps/common/infra/logger/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance/governance.repository'
import { PreimageModel } from 'apps/common/infra/postgresql/governance/models/preimage.model'

export const processDemocracyPreimageUsedEvent = async (event: EventEntry, governanceRepository: GovernanceRepository, logger: Logger) => {
  const eventData = JSON.parse(event.data)
  console.log({ eventData: JSON.stringify(eventData, null, 2) })

  const hash = eventData[0]['Hash']
  const accountId = eventData[1]['AccountId']
  const balance = parseInt(eventData[2]['Balance'], 16)

  const preimageRecord: PreimageModel = {
    proposal_hash: hash,
    block_id: event.block_id,
    event_id: event.event_id,
    extrinsic_id: '',
    event: 'preimageUsed',
    data: { accountId, balance },
  }

  await governanceRepository.preimages.save(preimageRecord)
}

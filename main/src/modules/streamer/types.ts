import { EventRecord } from '@polkadot/types/interfaces'
import { BlockModel } from 'apps/common/infra/postgresql/models/block.model'
import { ExtrinsicModel } from 'apps/common/infra/postgresql/models/extrinsic.model'

export type GovernanceExtrinsicEntry = {
  extrinsic: ExtrinsicModel
  block: BlockModel
  events: EventRecord[]
}

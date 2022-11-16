import { Compact, GenericExtrinsic, Vec } from '@polkadot/types'
import { BlockNumber, EventRecord } from '@polkadot/types/interfaces'


export type ExtrinsicsProcessorInput = {
  // eraId: number | null
  // epochId: number | null
  blockNumber: Compact<BlockNumber>
  events: Vec<EventRecord>
  extrinsics: Vec<GenericExtrinsic>
}
import { DelegatorModel } from '@/models/delegator.model'
import { CollatorModel } from '@/models/collator.model'
import { BlockHash, EraIndex } from '@polkadot/types/interfaces'

export type TBlockHash = string | BlockHash | Uint8Array
export type TBlockEra = number | string | EraIndex | Uint8Array

export interface IProcessEraPayload {
  eraId: string
  blockHash: TBlockHash
}

export interface IBlockEraParams {
  eraId: number
  blockHash: TBlockHash
}

export interface IGetCollatorsDeligatorsResult {
  collators: CollatorModel[]
  deligators: DelegatorModel[]
}

export type PayoutEvent = {
  eraId: number
  blockHash: TBlockHash
}

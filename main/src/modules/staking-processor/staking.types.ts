import { NominatorModel } from './../../apps/common/infra/postgresql/models/nominator.model'
import { ValidatorModel } from './../../apps/common/infra/postgresql/models/validator.model'
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

export interface IGetValidatorsNominatorsResult {
  nominators: NominatorModel[]
  validators: ValidatorModel[]
}

export type PayoutEvent = {
  eraId: number
  blockHash: TBlockHash
}

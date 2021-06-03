import { AccountId, BlockHash, EraIndex, EventRecord } from '@polkadot/types/interfaces'
import { AnyJson } from '@polkadot/types/types'

export type TBlockHash = string | BlockHash | Uint8Array
export type TBlockEra = number | string | EraIndex | Uint8Array

export interface IProcessEraPayload {
  eraPayoutEvent: EventRecord
  blockHash: TBlockHash
}

export interface IBlockEraParams {
  eraId: number
  blockHash: TBlockHash
}

export interface IGetValidatorsNominatorsResult {
  nominators: INominator[]
  validators: IValidator[]
}

export interface IStakingService {
  addToQueue(payload: IProcessEraPayload): void
}

export interface IValidator {
  account_id: string
  era: number
  total: string
  own: string
  nominators_count: number
  reward_points: number
  reward_dest?: string
  reward_account_id?: string
  prefs: Record<string, AnyJson>
}

export interface INominator {
  account_id: string
  era: number
  validator: string
  is_clipped: boolean
  value: string
  reward_dest?: string
  reward_account_id?: string
}

export interface IEraData {
  era: number
  session_start: number
  total_reward: string
  total_stake: string
  total_reward_points: number
}

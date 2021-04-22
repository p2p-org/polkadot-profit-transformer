import { AccountId, BlockHash, EraIndex, Moment, RewardPoint, SessionIndex, ValidatorId } from '@polkadot/types/interfaces'
import { AnyJson } from '@polkadot/types/types'

export interface IStakingService {
  syncValidators(blockNumber: number): Promise<void>

  extractStakers(era: TBlockEra, blockData: TBlockHash): Promise<void>

  getValidators(blockHash: TBlockHash, sessionId: SessionIndex, blockTime: Moment, blockEra: TBlockEra): Promise<IGetValidatorsResult>

  getStakersByValidator(
    blockHash: TBlockHash,
    sessionId: SessionIndex,
    blockTime: Moment,
    blockEra: TBlockEra,
    erasRewardPointsMap: Map<AccountId, RewardPoint>,
    validators: ValidatorId[],
    isEnabled: boolean
  ): Promise<IGetStakersByValidator>

  getFirstBlockFromDB(era: number, offset: number): Promise<Pick<IBlockModel, 'id' | 'hash'>>

  getLastEraFromDB(): Promise<IBlockModel['era']>

  updateMetaData(blockHash: TBlockHash): Promise<void>
}

export interface IBlockModel {
  id: string
  hash: string
  era: number
}

export interface IGetStakersByValidator {
  validators: IValidator[]
  nominators: INominator[]
}
export interface IGetValidatorsResult {
  validators: IValidator[]
  stakers: IStaker[]
  era_data: IEraData
  nominators: INominator[]
  nominators_active: number
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

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IStaker {}

export interface INominator {
  account_id: string
  era: number
  validator: string
  is_clipped: boolean
  value: string
  reward_dest?: string
  reward_account_id?: AccountId
}

export interface IEraData {
  era: number
  session_start: number
  total_reward: string
  total_stake: string
  total_reward_points: number
}

export type TBlockHash = string | BlockHash | Uint8Array
export type TBlockEra = number | string | EraIndex | Uint8Array

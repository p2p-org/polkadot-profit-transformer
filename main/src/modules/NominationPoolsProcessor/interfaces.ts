import { NominatorModel } from '@/models/nominator.model'
import { ValidatorModel } from '@/models/validator.model'
import { BlockHash, EraIndex } from '@polkadot/types/interfaces'

export type TBlockHash = string | BlockHash | Uint8Array
export type TBlockEra = number | string | EraIndex | Uint8Array

export interface IProcessEraPayload {
  eraId: string
  blockHash: TBlockHash
  pendingBlockHash?: TBlockHash
}

export interface IBlockEraParams {
  eraId: number
  blockHash: TBlockHash
  pendingBlockHash?: TBlockHash
}

export interface IGetValidatorsNominatorsResult {
  nominators: NominatorModel[]
  validators: ValidatorModel[]
}

export type PayoutEvent = {
  eraId: number
  blockHash: TBlockHash
}

export type PoolMemberData = {
  account: string
  data: {
    poolId: number
    points: number
    lastRecordedRewardCounter: string
    pendingRewards: number
    unbondingEras: any
  }
}

export type PoolMembers = {
  [poolId: string]: PoolMemberData
}

type BondedPoolRoles = {
  depositor: string
  root: string
  nominator: string
  stateToggler: string
  rewardAccount: string
  stashAccount: string
}

type BondedPool = {
  id: number
  points: number
  state: string
  memberCounter: number
  roles: BondedPoolRoles
}

type RewardPools = {
  lastRecordedRewardCounter: string
  lastRecordedTotalPayouts: number
  totalRewardsClaimed: number
}

type MembersBond = {
  poolId: number
  points: number
  lastRecordedRewardCounter: string
  pendingRewards: number
  unbondingEras: Record<string, any>
}

type SubPoolStorage = {
  noEra: Record<string, any>
  withEra: Record<string, any>
}

export type PoolData = {
  id: number
  points: number
  state: string
  memberCounter: number
  roles: BondedPoolRoles
  name: string
  rewardPools: RewardPools
  membersBond?: MembersBond
  members: PoolMembers
  subPoolStorage: SubPoolStorage
  commission: Record<string, any>
}

export type Pools = {
  [poolId: string]: PoolData | undefined
}

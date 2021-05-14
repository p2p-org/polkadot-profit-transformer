import { BlockHash, EraIndex } from '@polkadot/types/interfaces'

export type TBlockHash = string | BlockHash | Uint8Array
export type TBlockEra = number | string | EraIndex | Uint8Array

export interface IBlock {
  id: string
  hash: string
  state_root: string
  extrinsics_root: string
  parent_hash: string
  author: string
  session_id: number
  era: number
  last_log: string
  digest: { logs: [any] }
  block_time: Date
}

export interface IEra {
  era: number
  total_reward_points: number
  total_reward: number
  total_stake: number
}

export enum VerifierStatus {
  NEW = 'new',
  RUNNING = 'running',
  IDLE = 'idle',
  RESTART = 'restart'
}

export interface IWatchdogStatus {
  status: VerifierStatus
  current_height: number
  finished_at: string | undefined
}

export interface IWatchdogRestartResponse {
  result: boolean
}

export interface IWatchdogService {
  run(startBlockId: number | undefined): Promise<void>
  getStatus(): Promise<IWatchdogStatus>
  restartFromBlockId(newStartBlockId: number): Promise<IWatchdogRestartResponse>
}

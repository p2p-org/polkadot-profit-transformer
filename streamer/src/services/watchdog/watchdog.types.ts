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
  validators_active: number
  nominators_active: number
}

export enum VerifierStatus {
  NEW = 'new',
  RUNNING = 'running',
  IDLE = 'idle',
  RESTART = 'restart'
}

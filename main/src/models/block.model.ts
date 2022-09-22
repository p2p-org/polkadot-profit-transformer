import { Knex } from 'knex'

export type BlockModel = {
  id: number
  hash: string
  state_root: string
  extrinsics_root: string
  parent_hash: string
  author: string  
  era: number | null
  // current_era: number | null
  // epoch: number | null
  // last_log: string
  digest: any
  block_time: Date
}

export const BlockModel = (knex: Knex) => knex<BlockModel>('blocks')

import { Knex } from 'knex'

export type BlockMetadata = {
  round_id?: number
  era_id?: number
  active_era_id?: number
  session_id?: number
  runtime?: number
}

export type BlockModel = {
  block_id: number
  hash: string
  state_root: string
  extrinsics_root: string
  parent_hash: string
  author: string
  metadata: BlockMetadata
  digest: any
  block_time: Date
}

export const BlockModel = (knex: Knex) => knex<BlockModel>('blocks')

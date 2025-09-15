import { environment } from '@/environment'
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
  row_time?: Date
  row_id?: number
}

export const blocksTableName = `${environment.PG_TABLE_PREFIX}${environment.PG_RAW_TABLE_PREFIX}blocks`
export const BlockModel = (knex: Knex) => knex<BlockModel>(blocksTableName)

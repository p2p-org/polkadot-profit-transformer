import { Knex } from 'knex'

export type ExtrinsicModel = {
  extrinsic_id: string
  block_id: number
  parent_id?: string
  success: boolean
  // session_id: number
  // era: number
  section: string
  method: string
  mortal_period: number | null
  mortal_phase: number | null
  is_signed: boolean
  signer: string | null
  tip: string
  nonce: number
  ref_event_ids: any
  version: number
  extrinsic: any
  // args: any
  row_id?: number
  row_time?: Date
}

export const extrinsicsTableName = 'extrinsics'
export const ExtrinsicModel = (knex: Knex) => knex<ExtrinsicModel>(extrinsicsTableName)

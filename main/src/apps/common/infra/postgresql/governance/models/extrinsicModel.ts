import { Knex } from 'knex'

export type ExtrinsicModel = {
  id: string
  block_id: number
  parent_id: string
  session_id: number
  era: number
  section: string
  method: string
  mortal_period: number
  mortal_phase: number
  is_signed: boolean
  signer: string
  tip: number
  nonce: number
  ref_event_ids: string[]
  version: number
  extrinsic: any
  args: any
}

export const ExtrinsicModel = (knex: Knex) => knex<ExtrinsicModel>('extrinsics')

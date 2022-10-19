import { Knex } from 'knex'

export type PreimageModel = {
  proposal_hash: string
  block_id: number
  extrinsic_id: string
  event_id: string
  event: string
  data: any
}

export const PreimageModel = (knex: Knex) => knex<PreimageModel>('preimage')

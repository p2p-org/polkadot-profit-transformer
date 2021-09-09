import { Knex } from 'knex'

export type TechnicalCommiteeProposalModel = {
  hash: string
  id: number
  block_id: number
  event_id: string
  event: string
  data: any
}

export const TechnicalCommiteeProposalModel = (knex: Knex) => knex<TechnicalCommiteeProposalModel>('technical_committee_proposal')

export type PreimageModel = {
  hash: string
  block_id: number
  event_id: string
  extrinsic_id: string
  event: string
  data: any
}

export const PreimageModel = (knex: Knex) => knex<PreimageModel>('proposal_preimage')

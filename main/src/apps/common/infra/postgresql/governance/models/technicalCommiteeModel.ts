import { Knex } from 'knex'

export type TechnicalCommiteeProposalModel = {
  hash: string
  id: number | null
  block_id: number
  extrinsic_id: string
  event_id: string
  event: string
  data: any
}

export const TechnicalCommiteeProposalModel = (knex: Knex) => knex<TechnicalCommiteeProposalModel>('technical_committee_proposal')

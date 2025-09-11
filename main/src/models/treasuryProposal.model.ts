import { environment } from '@/environment'
import { Knex } from 'knex'

export type TreasuryProposalModel = {
  id: number
  block_id: number
  event_id: string
  extrinsic_id: string
  event: string
  data: any
}

export const TreasuryProposalModel = (knex: Knex) =>
  knex<TreasuryProposalModel>(`${environment.PG_TABLE_PREFIX}treasury_proposal`)

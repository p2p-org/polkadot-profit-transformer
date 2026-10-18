import { environment } from '@/environment'
import { Knex } from 'knex'

export type CouncilProposalModel = {
  id: number | null
  hash?: string
  block_id: number
  event_id: string
  extrinsic_id: string
  event: string
  data: any
}

export const CouncilProposalModel = (knex: Knex) => knex<CouncilProposalModel>(`${environment.PG_TABLE_PREFIX}council_proposal`)

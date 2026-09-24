import { environment } from '@/environment'
import { Knex } from 'knex'

export type DemocracyReferendaModel = {
  id: number
  block_id: number
  event_id: string
  extrinsic_id: string
  event: string
  data: any
}

export const DemocracyReferendaModel = (knex: Knex) =>
  knex<DemocracyReferendaModel>(`${environment.PG_TABLE_PREFIX}democracy_referenda`)

export type DemocracyProposalModel = {
  id: number
  hash: string
  block_id: number
  event_id: string
  extrinsic_id: string
  event: string
  data: any
}

export const DemocracyProposalModel = (knex: Knex) =>
  knex<DemocracyProposalModel>(`${environment.PG_TABLE_PREFIX}democracy_proposal`)

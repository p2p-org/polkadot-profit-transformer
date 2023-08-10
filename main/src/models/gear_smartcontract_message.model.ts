import { Knex } from 'knex'

export type GearSmartcontractMessageModel = {
  block_id: number
  extrinsic_id: string
  account_id: string | null
  program_id: string
  gas_limit: string
  payload: string
  value: string
  row_id?: number
  row_time?: Date
}

export const GearSmartcontractMessageModel = (knex: Knex) => knex<GearSmartcontractMessageModel>('gear_smartcontracts_messages')

import { Knex } from 'knex'

export type GearSmartcontractModel = {
  block_id: number
  extrinsic_id: string
  account_id: string | null
  program_id: string
  expiration: string
  gas_limit: string
  init_payload: string
  code: BinaryType
  row_id?: number
  row_time?: Date
}

export const GearSmartcontractModel = (knex: Knex) => knex<GearSmartcontractModel>('gear_smartcontracts')

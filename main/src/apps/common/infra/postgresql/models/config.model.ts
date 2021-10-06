import { Knex } from 'knex'

export type ConfigModel = {
  key: string
  value: string
}

export const ConfigModel = (knex: Knex) => knex<ConfigModel>('_config')

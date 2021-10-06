import { Knex } from 'knex'

export type EraModel = {
  era: number
  session_start: number
  total_reward: string
  total_stake: string
  total_reward_points: number
}

export const EraModel = (knex: Knex) => knex<EraModel>('eras')

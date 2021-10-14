import { TokenModel } from './../../../../common/infra/postgres/models'
import Knex from 'knex'
import { PoolModel } from '../../../../common/infra/postgres/models'

export const Query = (knex: Knex) => {
  return {
    pools: async (
      _: any,
      args: {
        orderBy: string | Knex.QueryBuilder<any, any>
        orderDirection: string | undefined
        first: number
        where?: any
      },
    ) => {
      console.log({ where: args.where })
      let query = PoolModel(knex)

      if (args.where) query = query.whereIn('address', args.where.id_in)

      query = query.orderBy(args.orderBy, args.orderDirection)
      if (args.first) query = query.limit(args.first)

      let pools

      pools = await query

      console.log({ pools: pools.length })
      return pools
    },
  }
}

export const PoolQuery = (knex: Knex) => {
  return {
    async token0(parent: { token0_id: any }) {
      const token = await TokenModel(knex).where({ id: parent.token0_id }).first()
      return token
    },
    async token1(parent: { token1_id: any }) {
      const token = await TokenModel(knex).where({ id: parent.token1_id }).first()
      return token
    },
  }
}

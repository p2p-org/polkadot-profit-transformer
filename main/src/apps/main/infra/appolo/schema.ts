import { gql } from 'apollo-server'

export const typeDefs = gql`
  type Token {
    id: Int
    symbol: String
    name: String
  }

  type Pool {
    address: String
    reserve_multiply_4_percent: Float
    reserve_multiply_24_percent: Float
    token0: Token
    token1: Token
  }

  enum OrderDirection {
    asc
    desc
  }

  enum subgraphError {
    allow
    disallow
  }

  enum OrderBy {
    reserve_multiply_4_percent
    reserve_multiply_24_percent
  }

  input PoolsFilter {
    id_in: [String]
  }

  type Query {
    pools(first: Int, orderBy: OrderBy, orderDirection: OrderDirection, subgraphError: subgraphError, where: PoolsFilter): [Pool]
  }
`

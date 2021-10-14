import { ApolloServer } from 'apollo-server'

import { PoolQuery, Query } from './queries'
import { typeDefs } from './schema'

export const appoloFactory = (knex: Knex) => {
  const resolvers = {
    Query: Query(knex),
    Pool: PoolQuery(knex),
  }

  return new ApolloServer({
    typeDefs,
    resolvers,
    context: async ({ req }) => {},
  })
}

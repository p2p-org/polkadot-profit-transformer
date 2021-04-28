import { PostgresModule } from '../modules/postgres.module'
import fastifyPlugin from 'fastify-plugin'
import { FastifyInstance } from 'fastify'
import { Pool } from 'pg'

declare module 'fastify' {
  interface FastifyInstance {
    postgresConnector: Pool;
  }
}

const postgresConnector = async (server: FastifyInstance) => {
  server.log.info(`Init "postgresConnector"`)
  server.decorate('postgresConnector', PostgresModule.inject())
}

export const registerPostgresPlugin = fastifyPlugin(postgresConnector)

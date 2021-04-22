import { Pool } from 'pg';
import fastifyPlugin from 'fastify-plugin';
import { FastifyInstance } from 'fastify';

declare module 'fastify' {
  interface FastifyInstance {
    postgresConnector: Pool;
  }
}

const {
  environment: { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT }
} = require('../environment');

const postgresConnector = async (server: FastifyInstance) => {
  server.log.info(`Init "postgresConnector"`);

  const pool = new Pool({
    host: DB_HOST,
    user: DB_USER,
    database: DB_NAME,
    password: DB_PASSWORD,
    port: DB_PORT
  });

  server.decorate('postgresConnector', pool);
};

export const registerPostgresPlugin = fastifyPlugin(postgresConnector);

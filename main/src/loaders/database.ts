import fs from 'fs'
import knex, { Knex } from 'knex'
import { environment } from '@/environment'
import { logger } from '@/loaders/logger'

export const KnexPG = async (connectionString: string): Promise<Knex> => {
  let ssl_options: any = {}

  if (environment.PG_SSL_ENABLED) {
    ssl_options.mode = environment.PG_SSL_MODE
    ssl_options.rejectUnauthorized = false
  }

  if (environment.PG_SSL_CA_PATH) {
    ssl_options.ca = fs.readFileSync(environment.PG_SSL_CA_PATH)
  }

  if (environment.PG_SSL_KEY_PATH) {
    ssl_options.key = fs.readFileSync(environment.PG_SSL_KEY_PATH)
  }

  if (environment.PG_SSL_CERT_PATH) {
    ssl_options.cert = fs.readFileSync(environment.PG_SSL_CERT_PATH)
  }

  const pgsql = knex({
    client: 'pg',
    debug: environment.LOG_LEVEL === 'debug',
    connection: {
      connectionString: environment.PG_CONNECTION_STRING,
      ssl: ssl_options ? ssl_options : {}
    },
    searchPath: ['knex', 'public'],
    pool: {
      min: 1,
      max: 20,
      createTimeoutMillis: 60 * 1000,
      acquireTimeoutMillis: 60 * 1000,
      idleTimeoutMillis: 10 * 60 * 1000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100,
      propagateCreateError: false,
    },
  })

  pgsql
    .raw('SELECT 1')
    .then(() => {
      logger.info('✌️ Database connected')
    })
    .catch((e: any) => {
      logger.error('Database not connected')
      logger.error(e)
    })

  return pgsql
}

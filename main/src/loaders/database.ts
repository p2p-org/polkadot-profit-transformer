import knex, { Knex } from 'knex'
import { environment } from '@/environment'
import { logger } from '@/loaders/logger'

export const KnexPG = async (connectionString: string): Promise<Knex> => {
  const pgsql = knex({
    client: 'pg',
    debug: environment.LOG_LEVEL === 'debug',
    connection: {
      connectionString: connectionString,
      ssl: false,
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

  pgsql.raw('SELECT 1').then(() => {
    logger.info('✌️ Database connected')
  }).catch((e: any) => {
    logger.error('Database not connected')
    logger.error(e)
  })

  return pgsql
}

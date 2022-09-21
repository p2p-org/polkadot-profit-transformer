import knex, {Knex} from 'knex'

export const KnexPG = async (connectionString: string, isDebug: boolean): Knex => {
  return knex({
    client: 'pg',
    debug: isDebug,
    connection: {
      connectionString: connectionString,
      ssl: false,
    },
    searchPath: ['knex', 'public'],
    pool: {
      min: 1,
      max: 20,
      createTimeoutMillis: 60*1000,
      acquireTimeoutMillis: 60*1000,
      idleTimeoutMillis: 10*60*1000,
      reapIntervalMillis: 1000,
      createRetryIntervalMillis: 100,
      propagateCreateError: false,
    },
  })
}
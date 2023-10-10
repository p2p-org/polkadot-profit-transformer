import fs from 'fs'
import knex, { Knex } from 'knex'
import { Environment, environment } from '@/environment'
import { logger } from '@/loaders/logger'

interface SSLOptions {
  mode?: string
  rejectUnauthorized?: boolean
  ca?: Buffer
  key?: Buffer
  cert?: Buffer
}

function readFileIfSetAndExists(filePath?: string): Buffer | undefined {
  if (filePath && fs.existsSync(filePath)) {
    return fs.readFileSync(filePath)
  } else {
    if (filePath) {
      logger.error(`File does not exists ${filePath}`)
    }
    return undefined
  }
}

function configureSSLOptions(options: SSLOptions, environment: Environment): void {
  options.mode = environment.PG_SSL_MODE
  options.rejectUnauthorized = false

  options.ca = readFileIfSetAndExists(environment.PG_SSL_CA_PATH)
  options.key = readFileIfSetAndExists(environment.PG_SSL_KEY_PATH)
  options.cert = readFileIfSetAndExists(environment.PG_SSL_CERT_PATH)
}

function configureConnectionOptions(connection: Knex.PgConnectionConfig, environment: Environment): void {
  if (environment.PG_CONNECTION_STRING) {
    connection.connectionString = environment.PG_CONNECTION_STRING
  } else {
    connection.host = environment.PG_HOST
    connection.port = environment.PG_PORT
    connection.user = environment.PG_USER
    connection.password = environment.PG_PASSWORD
    connection.database = environment.PG_DATABASE
  }

  const ssl_options: SSLOptions = {}
  if (environment.PG_SSL_ENABLED) {
    configureSSLOptions(ssl_options, environment)
    connection.ssl = ssl_options
  }
}

export const KnexPG = async (environment: Environment): Promise<Knex> => {
  const connection: Knex.PgConnectionConfig = {}

  configureConnectionOptions(connection, environment)

  const pgsql = knex({
    client: 'pg',
    debug: environment.LOG_LEVEL === 'debug',
    connection: connection,
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

import dotenv from 'dotenv'
import { cleanEnv, str, num, bool, url } from 'envalid'

dotenv.config()
process.env.NODE_ENV = process.env.NODE_ENV || 'development'

export enum NODE_ENV {
  DEVELOPMENT = 'development',
  PRODUCTION = 'production',
}

export enum MODE {
  LISTENER = 'LISTENER',
  BLOCK_PROCESSOR = 'BLOCK_PROCESSOR',
  NOMINATIONPOOLS_PROCESSOR = 'NOMINATIONPOOLS_PROCESSOR',
  STAKING_PROCESSOR = 'STAKING_PROCESSOR',
  IDENTITY_PROCESSOR = 'IDENTITY_PROCESSOR',
  BALANCES_PROCESSOR = 'BALANCES_PROCESSOR',
  GEAR_SMARTCONTRACTS_PROCESSOR = 'GEAR_SMARTCONTRACTS_PROCESSOR',
  MONITORING = 'MONITORING',
  HYBRID = 'HYBRID',
}

export type Environment = {
  SLACK_WEBHOOK?: string
  OPSGENIE_KEY?: string
  PG_CONNECTION_STRING?: string
  PG_HOST?: string
  PG_PORT?: number
  PG_USER?: string
  PG_PASSWORD?: string
  PG_DATABASE?: string
  PG_SSL_ENABLED?: boolean
  PG_SSL_MODE?: string
  PG_SSL_CA_PATH?: string
  PG_SSL_KEY_PATH?: string
  PG_SSL_CERT_PATH?: string
  GOOGLE_BIGQUERY_DATASET?: string
  LOG_LEVEL: string
  SUBSTRATE_URI: string
  ASSET_HUB_URI?: string
  RESTART_BALANCES_URI?: string
  RESTART_BLOCKS_URI?: string
  RESTART_ROUNDS_URI?: string
  RESTART_ERAS_URI?: string
  REST_API_PORT: number
  BASIC_AUTH: boolean
  REST_API_BASIC_AUTH_PASSWORD: string
  START_BLOCK_ID: number
  RABBITMQ: string
  NETWORK: string
  NODE_ENV: NODE_ENV
  MODE: MODE
  NETWORK_ID: number
  BATCH_INSERT_CHUNK_SIZE: number
  MAX_ATTEMPTS: number
}

const preEnv = cleanEnv(process.env, {
  SLACK_WEBHOOK: url({ default: '' }),
  OPSGENIE_KEY: str({ default: '' }),
  PG_CONNECTION_STRING: url({ default: '' }),
  PG_SSL_ENABLED: bool({ default: true }),
  GOOGLE_BIGQUERY_DATASET: str({ default: '' }),
  LOG_LEVEL: str({ default: 'info', choices: ['info', 'debug', 'trace', 'error'] }),
  SUBSTRATE_URI: url(),
  ASSET_HUB_URI: url({ default: '' }),
  RESTART_BALANCES_URI: str({ default: '' }),
  RESTART_BLOCKS_URI: str({ default: '' }),
  RESTART_ROUNDS_URI: str({ default: '' }),
  RESTART_ERAS_URI: str({ default: '' }),
  REST_API_PORT: num({ default: 3000 }),
  BASIC_AUTH: bool({ default: false }),
  REST_API_BASIC_AUTH_PASSWORD: str({ default: 'pwd' }),
  START_BLOCK_ID: num({ default: -1 }), // -1 = continue from last preloaded block from db
  RABBITMQ: url(),
  NETWORK: str(),
  NODE_ENV: str(),
  NETWORK_ID: num(),
  MODE: str({ choices: Object.values(MODE) }),
  BATCH_INSERT_CHUNK_SIZE: num({ default: 1000 }),
  MAX_ATTEMPTS: num({ default: 100 }),
  PG_SSL_CA_PATH: str({ default: '' }),
  PG_SSL_KEY_PATH: str({ default: '' }),
  PG_SSL_CERT_PATH: str({ default: '' }),
  PG_SSL_MODE: str({ default: 'require' }),
  PG_HOST: str({ default: '127.0.0.1' }),
  PG_PORT: num({ default: 5432 }),
  PG_USER: str({ default: 'postgres' }),
  PG_PASSWORD: str({ default: 'postgres' }),
  PG_DATABASE: str({ default: 'postgres' }),
})

const parseModeEnum = (env: typeof preEnv) => {
  const mode: MODE = env.MODE
  const nodeEnv: NODE_ENV = env.NODE_ENV === 'development' ? NODE_ENV.DEVELOPMENT : NODE_ENV.PRODUCTION
  return { ...env, MODE: mode, NODE_ENV: nodeEnv }
}

export const environment: Environment = parseModeEnum(preEnv)

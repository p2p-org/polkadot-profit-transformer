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
  STAKING_PROCESSOR = 'STAKING_PROCESSOR',
  IDENTITY_PROCESSOR = 'IDENTITY_PROCESSOR',
  BALANCES_PROCESSOR = 'BALANCES_PROCESSOR',
  GEAR_SMARTCONTRACTS_PROCESSOR = 'GEAR_SMARTCONTRACTS_PROCESSOR',
  MONITORING = 'MONITORING',
}

export type Environment = {
  SLACK_WEBHOOK?: string
  PG_CONNECTION_STRING: string
  LOG_LEVEL: string
  SUBSTRATE_URI: string
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
  PG_CONNECTION_STRING: url(),
  LOG_LEVEL: str({ default: 'info', choices: ['info', 'debug', 'trace', 'error'] }),
  SUBSTRATE_URI: url(),
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
  MAX_ATTEMPTS: num({ default: 5 }),
})


const parseModeEnum = (env: typeof preEnv) => {
  const mode: MODE = env.MODE
  //env.MODE === 'BLOCK_PROCESSOR' ? MODE.BLOCK_PROCESSOR : env.MODE === 'LISTENER' ? MODE.LISTENER : MODE.STAKING_PROCESSOR
  const nodeEnv: NODE_ENV =
    env.NODE_ENV === 'development' ? NODE_ENV.DEVELOPMENT : NODE_ENV.PRODUCTION
  return { ...env, MODE: mode, NODE_ENV: nodeEnv }
}

export const environment: Environment = parseModeEnum(preEnv)

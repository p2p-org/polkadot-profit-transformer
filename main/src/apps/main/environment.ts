import dotenv from 'dotenv'
import { cleanEnv, str, num, bool, url } from 'envalid'

process.env.NODE_ENV = process.env.NODE_ENV || 'development'

dotenv.config()

export enum MODE {
  LISTENER = 'LISTENER',
  BLOCK_PROCESSOR = 'BLOCK_PROCESSOR',
  STAKING_PROCESSOR = 'STAKING_PROCESSOR',
}

export type Environment = {
  PG_CONNECTION_STRING: string
  LOG_LEVEL: string
  SUBSTRATE_URI: string
  REST_API_PORT: number
  BASIC_AUTH: boolean
  REST_API_BASIC_AUTH_PASSWORD: string
  START_BLOCK_ID: number
  RABBITMQ: string
  NETWORK: string
  MODE: MODE
  NETWORK_ID: number
}

const parseModeEnum = (env: typeof preEnv) => ({ ...env, MODE: MODE[env.MODE] })

const preEnv = cleanEnv(process.env, {
  PG_CONNECTION_STRING: url(),
  LOG_LEVEL: str({ default: 'info', choices: ['info', 'debug', 'trace', 'error'] }),
  SUBSTRATE_URI: url(),
  REST_API_PORT: num({ default: 3000 }),
  BASIC_AUTH: bool({ default: false }),
  REST_API_BASIC_AUTH_PASSWORD: str({ default: 'pwd' }),
  START_BLOCK_ID: num({ default: -1 }), // -1 = continue from last preloaded block from db
  RABBITMQ: url(),
  NETWORK: str(),
  NETWORK_ID: num(),
  MODE: str({ choices: ['LISTENER', 'BLOCK_PROCESSOR', 'STAKING_PROCESSOR'] }),
})

export const environment: Environment = parseModeEnum(preEnv)

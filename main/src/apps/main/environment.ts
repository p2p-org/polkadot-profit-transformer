import dotenv from 'dotenv'

process.env.NODE_ENV = process.env.NODE_ENV || 'development'

dotenv.config()

export type Environment = {
  PG_CONNECTION_STRING: string | undefined
  LOG_LEVEL: string | undefined
  SUBSTRATE_URI: string | undefined
  REST_API_PORT: number
  BASIC_AUTH: boolean | undefined
  REST_API_BASIC_AUTH_PASSWORD: string
  PRELOAD: boolean
  START_BLOCK_ID: number
  SUBSCRIBE: boolean
  CONCURRENCY: number
}

export const environment: Environment = {
  PG_CONNECTION_STRING: process.env.PG_CONNECTION_STRING,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  SUBSTRATE_URI: process.env.SUBSTRATE_URI,
  REST_API_PORT: Number(process.env.REST_API_PORT) || 3000,
  BASIC_AUTH: process.env.BASIC_AUTH ? process.env.BASIC_AUTH === 'true' : false,
  REST_API_BASIC_AUTH_PASSWORD: process.env.REST_API_BASIC_AUTH_PASSWORD ?? 'password',
  PRELOAD: process.env.PRELOAD ? process.env.PRELOAD === 'true' : false,
  START_BLOCK_ID: process.env.START_BLOCK_ID ? Number(process.env.START_BLOCK_ID) : -1, // -1 = continue from last preloaded block from db
  SUBSCRIBE: process.env.SUBSCRIBE ? process.env.SUBSCRIBE === 'true' : false,
  CONCURRENCY: process.env.CONCURRENCY ? Number(process.env.CONCURRENCY) : 5,
}

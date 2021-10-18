import dotenv from 'dotenv'

// Set the NODE_ENV to 'development' by default
process.env.NODE_ENV = process.env.NODE_ENV || 'development'

dotenv.config()

export type Environment = {
  PG_CONNECTION_STRING: string | undefined
  LOG_LEVEL: string | undefined
  SUBSTRATE_URI: string | undefined
  REST_API_PORT: number
  REST_API_BASIC_AUTH_PASSWORD: string
  PRELOAD: boolean
  START_BLOCK_ID: number | undefined
  SUBSCRIBE: boolean
}

export const environment: Environment = {
  PG_CONNECTION_STRING: process.env.PG_CONNECTION_STRING,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  SUBSTRATE_URI: process.env.SUBSTRATE_URI,
  REST_API_PORT: Number(process.env.REST_API_PORT) || 3000,
  REST_API_BASIC_AUTH_PASSWORD: process.env.REST_API_BASIC_AUTH_PASSWORD ?? 'password',
  PRELOAD: process.env.PRELOAD ? Boolean(process.env.PRELOAD) : false,
  START_BLOCK_ID: process.env.START_BLOCK_ID ? Number(process.env.START_BLOCK_ID) : 0,
  SUBSCRIBE: process.env.SUBSCRIBE ? Boolean(process.env.SUBSCRIBE) : false,
}

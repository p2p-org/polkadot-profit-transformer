import dotenv from 'dotenv'

// Set the NODE_ENV to 'development' by default
process.env.NODE_ENV = process.env.NODE_ENV || 'development'

const envFound = dotenv.config()
if (envFound.error) {
  throw new Error("⚠️  Couldn't find .env file  ⚠️")
}

export type Environment = {
  PG_CONNECTION_STRING: string | undefined
  DB_SCHEMA: string | undefined
  LOG_LEVEL: string | undefined
  SUBSTRATE_URI: string | undefined
  PROCESS_EXTRINSICS: boolean
  PROCESS_EVENTS: boolean
  REST_API_PORT: number
}

export const environment = {
  PG_CONNECTION_STRING: process.env.PG_CONNECTION_STRING,
  DB_SCHEMA: process.env.DB_SCHEMA,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  APP_ID: process.env.APP_ID,
  SUBSTRATE_URI: process.env.SUBSTRATE_URI,
  PROCESS_EXTRINSICS: Boolean(process.env.PROCESS_EXTRINSICS) || true,
  PROCESS_EVENTS: Boolean(process.env.PROCESS_EVENTS) || false,
  REST_API_PORT: Number(process.env.REST_API_PORT) || 3000,
}

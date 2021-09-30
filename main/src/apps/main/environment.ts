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
  APP_ID: string | undefined
  KAFKA_URI: string | undefined
  KAFKA_PREFIX: string | undefined
  SUBSTRATE_URI: string | undefined
  PROCESS_EXTRINSICS: boolean
  PROCESS_EVENTS: boolean
}

export const environment = {
  PG_CONNECTION_STRING: process.env.PG_CONNECTION_STRING,
  DB_SCHEMA: process.env.DB_SCHEMA,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  APP_ID: process.env.APP_ID,
  KAFKA_URI: process.env.KAFKA_URI,
  KAFKA_PREFIX: process.env.KAFKA_PREFIX,
  SUBSTRATE_URI: process.env.SUBSTRATE_URI,
  PROCESS_EXTRINSICS: Boolean(process.env.PROCESS_EXTRINSICS) || true,
  PROCESS_EVENTS: Boolean(process.env.PROCESS_EVENTS) || false,
}

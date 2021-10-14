import dotenv from 'dotenv'

// Set the NODE_ENV to 'development' by default
process.env.NODE_ENV = process.env.NODE_ENV || 'development'

const envFound = dotenv.config()
if (envFound.error) {
  throw new Error("⚠️  Couldn't find .env file  ⚠️")
}

export type Environment = {
  PG_CONNECTION_STRING: string | undefined
  LOG_LEVEL: string | undefined
  APP_ID: string | undefined
  SUBSTRATE_URI: string | undefined
}

export const environment: Environment = {
  PG_CONNECTION_STRING: process.env.PG_CONNECTION_STRING,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  APP_ID: process.env.APP_ID,
  SUBSTRATE_URI: process.env.SUBSTRATE_URI,
}

const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.resolve(__dirname, '.env') })

const applicationId = 'substrate_streamer'

const environment = {
  APP_ID: applicationId,
  APP_CLIENT_ID: 'mbelt-' + applicationId + '-' + process.env.APP_MODE.toLowerCase() + '-' + process.env.APP_NETWORK.toLowerCase(),
  APP_MODE: process.env.APP_MODE || 'dev',
  APP_NETWORK: process.env.APP_NETWORK,

  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // Api
  API_ADDR: process.env.API_ADDR || '0.0.0.0',
  API_PORT: process.env.API_PORT || '8080',

  // Node
  SUBSTRATE_URI: process.env.SUBSTRATE_URI,

  // Kafka
  KAFKA_URI: process.env.KAFKA_URI,
  KAFKA_PREFIX: 'SUBSTRATE_STREAMER_' + process.env.APP_MODE.toUpperCase() + '_' + process.env.APP_NETWORK.toUpperCase(),

  // Postgres
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: process.env.DB_PORT || 5432,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_SCHEMA: process.env.DB_SCHEMA || 'public'
}

module.exports = environment

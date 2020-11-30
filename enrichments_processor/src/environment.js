const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.resolve(__dirname, '.env') })

const environment = {
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // Api
  API_ADDR: process.env.API_ADDR || '0.0.0.0',
  API_PORT: process.env.API_PORT || '8080',

  // Node
  SUBSTRATE_URI: process.env.SUBSTRATE_URI,

  // Kafka
  KAFKA_URI: process.env.KAFKA_URI,

  // Postgres
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: process.env.DB_PORT || 5432,
  DB_NAME: process.env.DB_NAME,
  DB_USER: process.env.DB_USER || 'postgres',
  DB_PASSWORD: process.env.DB_PASSWORD || ''
}

module.exports = environment

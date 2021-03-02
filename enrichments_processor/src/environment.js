const dotenv = require('dotenv')
const path = require('path')

dotenv.config({ path: path.resolve(__dirname, '.env') })

const applicationId = 'enrichments_processor'

const requiredVariables = ['APP_MODE', 'APP_NETWORK', 'SUBSTRATE_URI', 'KAFKA_URI']

const environment = {
  APP_ID: applicationId,
  APP_CLIENT_ID: 'mbelt-' + applicationId + '-' + process.env.APP_MODE.toLowerCase() + '-' + process.env.APP_NETWORK.toLowerCase(),
  APP_MODE: process.env.APP_MODE || 'dev',
  APP_NETWORK: process.env.APP_NETWORK,

  LOG_LEVEL: process.env.LOG_LEVEL || 'info',

  // Api
  API_ADDR: process.env.API_ADDR || '0.0.0.0',
  API_PORT: process.env.API_PORT || '8079',

  // Node
  SUBSTRATE_URI: process.env.SUBSTRATE_URI,

  // Kafka
  KAFKA_URI: process.env.KAFKA_URI,
  KAFKA_PREFIX: 'SUBSTRATE_STREAMER_' + process.env.APP_MODE.toUpperCase() + '_' + process.env.APP_NETWORK.toUpperCase(),

}

/**
 * Validate environment variables
 *
 * @async
 * @param app FastifyInstance
 * @returns {Promise<boolean>}
 */
const validateEnv = async (app) => {
  requiredVariables.forEach((key)=>{
    if (!process.env[key]) {
      throw new Error(`${key} is not set`)
    } else if (process.env[key].length < 3) {
      throw new Error(`${key} too short`)
    }
  })

  const kafkaHostPattern = new RegExp('^\\w+\:\\d+$')
  if (!kafkaHostPattern.exec(process.env.KAFKA_URI)) {
    console.log(process.env.KAFKA_URI)
    throw new Error(`KAFKA_URI should be set as pattern "hostname:port"`)
  }
}

module.exports = {
  environment,
  validateEnv,
}
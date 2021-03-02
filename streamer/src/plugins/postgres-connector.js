const { Pool } = require('pg')
const fastifyPlugin = require('fastify-plugin')

const { environment: { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT } } = require('../environment')

const postgresConnector = async (server, options = {}) => {
  server.log.info(`Init "postgresConnector"`)

  const pool = new Pool({
    host: DB_HOST,
    user: DB_USER,
    database: DB_NAME,
    password: DB_PASSWORD,
    port: DB_PORT
  })

  server.decorate('postgresConnector', pool)
}

module.exports = fastifyPlugin(postgresConnector)

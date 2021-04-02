const { Pool } = require('pg')
const { environment} = require('../../../environment')

/** @type {Pool} */
const pool = new Pool({
    host: environment.DB_HOST,
    user: environment.DB_USER,
    database: environment.DB_NAME,
    password: environment.DB_PASSWORD,
    port: environment.DB_PORT
})

module.exports = {
    pool
}

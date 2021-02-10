const { Pool } = require('pg')

const DB_HOST = '195.201.39.188'
const DB_USER = 'p2p_da_user'
const DB_PASSWORD = 'k85FBcAjXmp_ykGvXYaBk8BX_WgYjrN7j_dG8CA3UuF'
const DB_NAME = 'raw'
const DB_PORT = 5432

/** @type {Pool} */
const pool = new Pool({
  host: DB_HOST,
  user: DB_USER,
  database: DB_NAME,
  password: DB_PASSWORD,
  port: DB_PORT
})

module.exports = {
  pool
}

import type { Knex } from "knex";
import dotenv from 'dotenv'

dotenv.config()

const dbConfig: Knex.Config = {
  client: "postgresql",
  connection: {
    connectionString: process.env.PG_CONNECTION_STRING,
    ssl: false,
  },
  pool: {
    min: 2,
    max: 10
  },
  migrations: {
    tableName: "migrations"
  }
}

export default dbConfig

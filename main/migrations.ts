import type { Knex } from "knex";
import { environment, MODE } from './src/apps/main/environment'

const dbConfig: Knex.Config = {
  client: "postgresql",
  connection: {
    connectionString: environment.PG_CONNECTION_STRING,
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

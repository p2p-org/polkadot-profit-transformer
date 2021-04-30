import { Pool } from 'pg'

const {
	environment: { DB_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT }
} = require('../environment')

export class PostgresModule {
	private static instance: PostgresModule

	private pool: Pool;
	private constructor() {
		this.pool = new Pool({
			host: DB_HOST,
			user: DB_USER,
			database: DB_NAME,
			password: DB_PASSWORD,
			port: DB_PORT
		})
	}

	static async init(): Promise<void> {
		if (!PostgresModule.instance) {
			PostgresModule.instance = new PostgresModule()
		}
	}
	static inject(): Pool {
		if (!PostgresModule.instance) {
			throw new Error(`You haven't initiated postgresmodule`)
		}

		return PostgresModule.instance.pool
	}
}

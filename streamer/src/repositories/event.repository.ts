import { environment } from '../environment'
import { Pool } from 'pg'
import { PostgresModule } from '@modules/postgres.module'
import { LoggerModule } from '@modules/logger.module'

const { DB_SCHEMA } = environment

export class EventRepository {
	static schema: string = DB_SCHEMA
	private static instance: EventRepository

	private readonly connectionProvider: Pool = PostgresModule.inject()
	private readonly logger: LoggerModule = LoggerModule.inject()
	
	async getEventCountByBlock(blockId: number): Promise<number> {
		const {
			rows: [{ count }]
		} = await this.connectionProvider.query({
			text: `SELECT count(*) FROM ${DB_SCHEMA}.events WHERE "block_id" = $1::int`,
			values: [blockId]
		})
		
		return +count
	}
}

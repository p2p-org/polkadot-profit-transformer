import { IEra } from '@services/watchdog'
import { environment } from '../environment'
import { Pool } from 'pg'
import { PostgresModule } from '@modules/postgres.module'
import { LoggerModule } from '@modules/logger.module'

const { DB_SCHEMA } = environment

export class EraRepository {
	static schema: string = DB_SCHEMA
	private static instance: EraRepository

	private readonly connectionProvider: Pool = PostgresModule.inject()
	private readonly logger: LoggerModule = LoggerModule.inject()

	constructor() {
		if (EraRepository.instance) {
			return EraRepository.instance
		}

		EraRepository.instance = this
	}


	async getEra(eraId: number): Promise<IEra> {
		try {
			const { rows } = await this.connectionProvider.query({
				text: `SELECT * FROM ${DB_SCHEMA}.eras WHERE "era" = $1::int`,
				values: [eraId]
			})

			return rows[0]
		} catch (err) {
			this.logger.error(`failed to get era by id ${eraId}, error: ${err}`)
			throw new Error(`cannot get era by id ${eraId}`)
		}
	}

	async getEraStakingDiff(eraId: number): Promise<any> {
		try {
			const { rows } = await this.connectionProvider.query({
				text: `select e.era as era, e.total_stake  - sum(v.total) as diff from dot_polka.eras e 
					join dot_polka.validators v
					on v.era = e.era
					where e.era = $1::int
					group by e.era`,
				values: [eraId]
			})

			return rows[0]
		} catch (err) {
			this.logger.error(`failed to get staking diff by id ${eraId}, error: ${err}`)
			throw new Error(`failed to get staking diff by id ${eraId}`)
		}
	}
}

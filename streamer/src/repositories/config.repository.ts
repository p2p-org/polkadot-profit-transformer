import { Pool } from 'pg'
import { PostgresModule } from '../modules/postgres.module'
import { LoggerModule, ILoggerModule } from '../modules/logger.module'
import { environment } from '../environment'

const { DB_SCHEMA } = environment

export class ConfigRepository {
  static schema: string = DB_SCHEMA

  private readonly connectionProvider: Pool = PostgresModule.inject()
  private readonly logger: ILoggerModule = LoggerModule.inject()

  async update(key: string, value: string | number): Promise<void> {
    try {
      await this.connectionProvider.query({
        text: `UPDATE ${ConfigRepository.schema}._config SET "value" = $2 WHERE "key" = $1`,
        values: [key, value]
      })
    } catch (err) {
      this.logger.error({ err }, `failed to updateConfigValueInDB config `)
      throw new Error('cannot updateConfigValueInDB config value')
    }
  }

  async find(key: string): Promise<string | undefined> {
    try {
      const result = await this.connectionProvider.query({
        text: `SELECT "value" FROM ${ConfigRepository.schema}._config WHERE "key" = $1 LIMIT 1`,
        values: [key]
      })

      return result.rows[0]?.value
    } catch (err) {
      this.logger.error({ err }, `failed to get config key`)
      throw new Error('cannot get config value')
    }
  }

  async insert(key: string, value: string | number): Promise<void> {
    try {
      await this.connectionProvider.query({
        text: `INSERT INTO  ${DB_SCHEMA}._config VALUES ($1, $2)`,
        values: [key, value]
      })
    } catch (err) {
      this.logger.error({ err }, `failed to set config key`)
      throw new Error('cannot set config value')
    }
  }
}

import { environment } from '../../environment'
import { IConfigService } from './config.types'
import { FastifyInstance } from 'fastify'

const { DB_SCHEMA } = environment
/**
 * Provides config operations
 * @class
 */
class ConfigService implements IConfigService {
  private readonly app: FastifyInstance
  /**
   * Creates an instance of ConfigsService.
   * @param {object} app fastify app
   */
  constructor(app: FastifyInstance) {
    if (!app.ready) throw new Error(`can't get .ready from fastify app.`)

    /** @private */
    this.app = app

    const { polkadotConnector } = this.app

    if (!polkadotConnector) {
      throw new Error('cant get .polkadotConnector from fastify app.')
    }

    const { postgresConnector } = this.app

    if (!postgresConnector) {
      throw new Error('cant get .postgresConnector from fastify app.')
    }

    postgresConnector.connect((err, client, release) => {
      if (err) {
        this.app.log.error(`Error acquiring client: ${err.toString()}`)
        throw new Error(`Error acquiring client`)
      }
      client.query('SELECT NOW()', (err) => {
        release()
        if (err) {
          this.app.log.error(`Error executing query: ${err.toString()}`)
          throw new Error(`Error executing query`)
        }
      })
    })
  }

  async bootstrapConfig(): Promise<void> {
    const { polkadotConnector } = this.app

    const [currentChain, currentChainType] = (
      await Promise.all([
        polkadotConnector.rpc.system.chain(), // Polkadot
        polkadotConnector.rpc.system.chainType() // Live
      ])
    ).map((value) => value.toString().trim())

    if (!currentChain) {
      throw new Error('Node returns empty "system.chain" value')
    }

    if (!currentChainType) {
      throw new Error('Node returns empty "system.chainType" value')
    }

    const [dbChain, dbChainType] = await Promise.all([this.getConfigValueFromDB('chain'), this.getConfigValueFromDB('chain_type')])

    if (!dbChain && !dbChainType) {
      this.app.log.info(`Init new chain config: chain="${currentChain}", chain_type="${currentChainType}"`)
      await Promise.all([this.setConfigValueToDB('chain', currentChain), this.setConfigValueToDB('chain_type', currentChainType)])
    }

    if (dbChain !== currentChain) {
      throw new Error(`Node "system.chain" not compare to saved type: "${currentChain}" and "${dbChain}"`)
    }

    if (dbChainType !== currentChainType) {
      throw new Error(`Node "system.chainType" not compare to saved type: "${currentChainType}" and "${dbChainType}"`)
    }

    const watchdogVerifyHeight = await this.getConfigValueFromDB('watchdog_verify_height')

    console.log({ watchdogVerifyHeight })

    if (!watchdogVerifyHeight || !watchdogVerifyHeight.length) {
      await this.setConfigValueToDB('watchdog_verify_height', 0)
    }

    const watchdogStartedAt = await this.getConfigValueFromDB('watchdog_started_at')

    if (!watchdogStartedAt || !watchdogStartedAt.length) {
      await this.setConfigValueToDB('watchdog_started_at', 0)
    }

    const watchdogFinishedAt = await this.getConfigValueFromDB('watchdog_finished_at')

    if (!watchdogFinishedAt || !watchdogFinishedAt.length) {
      await this.setConfigValueToDB('watchdog_finished_at', 0)
    }
  }

  async setConfigValueToDB(key: string, value: string | number): Promise<void> {
    console.log('setConfigToDB', { key, value })

    const valueToSave = value.toString()
    const { postgresConnector } = this.app

    if (!key.length) {
      throw new Error('"key" is empty')
    }

    if (!valueToSave.length) {
      throw new Error(`setConfigValueToDB "value" for key ${key} is empty`)
    }

    try {
      await postgresConnector.query({
        text: `INSERT INTO  ${DB_SCHEMA}._config VALUES ($1, $2)`,
        values: [key, valueToSave]
      })
    } catch (err) {
      this.app.log.error(`failed to set config key "${err}"`)
      throw new Error('cannot set config value')
    }
  }

  async getConfigValueFromDB(key: string): Promise<string> {
    const { postgresConnector } = this.app

    if (!key.length) {
      throw new Error('"key" is empty')
    }

    try {
      const result = await postgresConnector.query({
        text: `SELECT "value" FROM ${DB_SCHEMA}._config WHERE "key" = $1 LIMIT 1`,
        values: [key]
      })

      return result.rows[0]?.value
    } catch (err) {
      this.app.log.error(`failed to get config key "${err}"`)
      throw new Error('cannot get config value')
    }
  }

  async updateConfigValueInDB(key: string, value: string | number): Promise<void> {
    const { postgresConnector } = this.app

    if (!key.length) {
      throw new Error('updateConfigValueInDB "key" is empty')
    }

    try {
      await postgresConnector.query({
        text: `UPDATE ${DB_SCHEMA}._config SET "value" = $2 WHERE "key" = $1`,
        values: [key, value]
      })
    } catch (err) {
      this.app.log.error(`failed to updateConfigValueInDB config key "${err}"`)
      throw new Error('cannot updateConfigValueInDB config value')
    }
  }
}

/**
 *
 * @type {{ConfigService: ConfigService}}
 */
export { ConfigService }

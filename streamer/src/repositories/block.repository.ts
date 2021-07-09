import { environment } from '../environment'
import { Pool } from 'pg'
import { PostgresModule } from '../modules/postgres.module'
import { LoggerModule, ILoggerModule } from '../modules/logger.module'
import { IBlock } from '../services/watchdog/watchdog.types'

const { DB_SCHEMA } = environment

export class BlockRepository {
  static schema: string = DB_SCHEMA
  private static instance: BlockRepository

  private readonly connectionProvider: Pool = PostgresModule.inject()
  private readonly logger: ILoggerModule = LoggerModule.inject()

  static inject(): BlockRepository {
    if (!BlockRepository.instance) {
      BlockRepository.instance = new BlockRepository()
    }

    return BlockRepository.instance
  }

  async getLastProcessedBlock(): Promise<number> {
    let blockNumberFromDB = 0

    try {
      const queryText = `SELECT id AS last_number FROM ${BlockRepository.schema}.blocks ORDER BY id DESC LIMIT 1`
      const { rows } = await this.connectionProvider.query(queryText)

      if (rows.length && rows[0].last_number) {
        blockNumberFromDB = parseInt(rows[0].last_number)
      }
    } catch (err) {
      this.logger.error({ err }, 'failed to get last synchronized block number')
      throw new Error('cannot get last block number')
    }

    return blockNumberFromDB
  }

  async getFirstBlockInEra(eraId: number): Promise<IBlock> {
    try {
      const { rows } = await this.connectionProvider.query({
        text: `SELECT * FROM ${DB_SCHEMA}.blocks WHERE "era" = $1::int order by "id" limit 1`,
        values: [eraId]
      })

      return rows[0]
    } catch (err) {
      this.logger.error({ err }, `failed to get first block of session`)
      throw new Error('cannot find first era block')
    }
  }

  async getFirstBlockInSession(sessionId: number): Promise<IBlock> {
    const { rows } = await this.connectionProvider.query({
      text: `SELECT * FROM ${BlockRepository.schema}.blocks WHERE "session_id" = $1::int order by "id" limit 1`,
      values: [sessionId]
    })

    return rows[0]
  }

  async removeBlockData(blockNumbers: number[]): Promise<void> {
    const transaction = await this.connectionProvider.connect()

    try {
      await transaction.query({
        text: `DELETE FROM "${BlockRepository.schema}.blocks" WHERE "id" = ANY($1::int[])`,
        values: [blockNumbers]
      })

      for (const tbl of ['balances', 'events', 'extrinsics']) {
        await transaction.query({
          text: `DELETE FROM "${BlockRepository.schema}.${tbl}" WHERE "block_id" = ANY($1::int[])`,
          values: [blockNumbers]
        })
      }

      await transaction.query('COMMIT')
    } catch (err) {
      this.logger.error({ err }, `failed to remove block from table`)
      await transaction.query('ROLLBACK')
      throw new Error('cannot remove blocks')
    } finally {
      transaction.release()
    }
  }

  async trimBlocksFrom(startBlockNumber: number): Promise<void> {
    const transaction = await this.connectionProvider.connect()

    try {
      await transaction.query({
        text: `DELETE FROM "${BlockRepository.schema}.blocks" WHERE "id" >= $1::int`,
        values: [startBlockNumber]
      })

      for (const tbl of ['balances', 'events', 'extrinsics']) {
        await transaction.query({
          text: `DELETE FROM "${BlockRepository.schema}.${tbl}" WHERE "id" >= $1::int`,
          values: [startBlockNumber]
        })
      }

      await transaction.query('COMMIT')
    } catch (err) {
      this.logger.error({ err }, `failed to remove blocks from table`)
      await transaction.query('ROLLBACK')
      throw new Error('cannot remove blocks')
    } finally {
      transaction.release()
    }
  }
}

import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { BlockModel } from '@/models/block.model'
import { environment } from '@/environment'
import { Logger } from 'pino'

@Service()
export class MonitoringDatabaseHelper {
  constructor(@Inject('knex') private readonly knex: Knex, @Inject('logger') private readonly logger: Logger) {}

  async removeOldExtrinsicsBody(): Promise<void> {
    const sql = `
      UPDATE extrinsics 
      SET extrinsic = NULL 
      WHERE
        network_id=${environment.NETWORK_ID}
        AND row_time < NOW() - INTERVAL '1 month'
        AND row_time >  NOW() - INTERVAL '1 month' - INTERVAL '1 day'`
    await this.knex.raw(sql)
  }

  async getLastBlock(): Promise<BlockModel> {
    const sql = `
      SELECT * 
      FROM blocks      
      WHERE network_id=${environment.NETWORK_ID}
      ORDER BY block_id DESC
      LIMIT 1`
    const blocks = await this.knex.raw(sql)
    return blocks.rows[0]
  }

  async getDublicatesBlocks(): Promise<Array<any>> {
    const sql = `
      SELECT block_id, COUNT(block_id) as count_id
      FROM (
          SELECT block_id
          FROM blocks
          WHERE network_id=${environment.NETWORK_ID}
          ORDER BY block_id DESC
          LIMIT 10000
      ) AS latest_blocks
      GROUP BY block_id
      HAVING COUNT(*) > 1
      LIMIT 10`
    const dublicatesBlocks = await this.knex.raw(sql)
    return dublicatesBlocks.rows
  }

  async getMissedBlocks(lastBlockId: number): Promise<Array<any>> {
    const missedBlocksSQL = `
      SELECT generate_series(${lastBlockId - 10002}, ${lastBlockId - 2}) as missing_block except 
      SELECT block_id FROM blocks WHERE network_id=${environment.NETWORK_ID} 
      ORDER BY missing_block
      LIMIT 10`
    const missedBlocksRows = await this.knex.raw(missedBlocksSQL)
    return missedBlocksRows.rows
  }

  async getMissedRounds(lastRoundId?: number): Promise<Array<any>> {
    if (!lastRoundId) return []
    const missedRoundsSQL = `
      SELECT generate_series(3, ${lastRoundId - 3}) as missing_round except 
      SELECT round_id FROM rounds WHERE network_id=${environment.NETWORK_ID}
      ORDER BY missing_round
      LIMIT 10`
    const missedRoundsRows = await this.knex.raw(missedRoundsSQL)
    return missedRoundsRows.rows
  }

  async getMissedEras(lastEraId?: number): Promise<Array<any>> {
    if (!lastEraId) return []
    const startEra = environment.NETWORK === 'kusama' ? 760 : 1
    const missedErasSQL = `
      SELECT generate_series(${startEra}, ${lastEraId - 2}) as missing_era 
      EXCEPT
        SELECT era_id FROM eras WHERE network_id=${environment.NETWORK_ID} 
      ORDER BY missing_era
      LIMIT 10`
    const missedErasRows = await this.knex.raw(missedErasSQL)
    return missedErasRows.rows
  }

  async getMissedProcessingTasks(): Promise<Array<any>> {
    const missedTasksSQL = `
      SELECT entity, entity_id 
      FROM processing_tasks pt 
      WHERE 
        network_id=${environment.NETWORK_ID}
        AND status='not_processed' 
        AND finish_timestamp is null 
        AND start_timestamp < NOW() - INTERVAL '1 DAY'
      LIMIT 10`
    const missedTasksRows = await this.knex.raw(missedTasksSQL)
    return missedTasksRows.rows
  }
}

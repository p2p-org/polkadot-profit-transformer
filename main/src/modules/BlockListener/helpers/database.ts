import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { Logger } from 'pino'

import { ENTITY } from '@/models/processing_task.model'
import { ProcessingStateModel } from '@/models/processing_status.model'
import { BlockModel } from '@/models/block.model'
import { environment } from '@/environment'

const network = { network_id: environment.NETWORK_ID }

@Service()
export class BlockListenerDatabaseHelper {

  constructor(
    @Inject('knex') private readonly knex: Knex,
    @Inject('logger') private readonly logger: Logger,
  ) { }

  public async findLastEntityId(entity: ENTITY): Promise<number> {
    const lastEntity = await ProcessingStateModel(this.knex)
      .where({ entity, ...network })
      .orderBy('row_id', 'desc')
      .limit(1)
      .first()

    this.logger.debug({
      event: 'ProcessingStatusRepository findLastEntityId',
      entity,
      lastEntity,
    })
    const lastEntityId = lastEntity ? Number(lastEntity.entity_id) : -1
    this.logger.debug({ lastEntityId })
    return lastEntityId
  }

  public async updateLastTaskEntityId(status: ProcessingStateModel<ENTITY>, trx: Knex.Transaction<any, any[]>): Promise<void> {
    await ProcessingStateModel(this.knex)
      .transacting(trx)
      .insert({ ...status, ...network })
      .onConflict(['entity', 'network_id'])
      .merge()
  }

  public async getUnprocessedBlocksMetadata(
    block_id?: number
  ): Promise<Array<BlockModel>> {

    const whereFilter = { metadata: null }

    const blocksRecords = BlockModel(this.knex)
      .select()
      .where(whereFilter)
      .orderBy('block_id', 'asc')
      .limit(environment.BATCH_INSERT_CHUNK_SIZE)

    if (block_id) {
      blocksRecords.andWhere('block_id', '>', block_id)
    }

    return await blocksRecords
  }
}

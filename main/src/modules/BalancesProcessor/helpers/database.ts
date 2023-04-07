import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { Logger } from 'pino'
import { ProcessingStateModel } from '@/models/processing_status.model'
import { ENTITY } from '@/models/processing_task.model'
import { BlockModel } from '@/models/block.model'
import { environment } from '@/environment'
import { BalancesModel } from '@/models/balances.model'
import { AccountModel } from '@/models/accounts.model'

const network = { network_id: environment.NETWORK_ID }
@Service()
export class BalancesDatabaseHelper {

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

  public async updateLastTaskEntityId(status: ProcessingStateModel<ENTITY>): Promise<void> {
    await ProcessingStateModel(this.knex)
      .insert({ ...status, ...network })
      .onConflict(['entity', 'network_id'])
      .merge()
  }

  public async getUnprocessedBlocks(
    row_id?: number
  ): Promise<Array<BlockModel>> {
    const blocks = BlockModel(this.knex)
      .select()
      .where({ ...network })
      .orderBy('row_id', 'asc')
      .limit(environment.BATCH_INSERT_CHUNK_SIZE)

    if (row_id) {
      blocks.andWhere('row_id', '>', row_id)
    }

    return await blocks
  }

  public async getBlock(
    block_id?: number
  ): Promise<BlockModel | undefined> {
    const block = BlockModel(this.knex)
      .select()
      .where({ block_id, ...network })
      .first()

    return await block
  }

  public async saveBalances(data: BalancesModel, trx: Knex.Transaction<any, any[]>): Promise<void> {
    const accountRow = await AccountModel(this.knex)
      .transacting(trx)
      .where({ blake2_hash: data.blake2_hash, ...network })
      .limit(1)
      .first()

    if (accountRow) {
      data.account_id = accountRow.account_id
    }

    try {
      await BalancesModel(this.knex)
        .insert({ ...data, ...network, row_time: new Date() })
        .onConflict(['block_id', 'blake2_hash', 'network_id'])
        .merge()
    } catch (err) {
      this.logger.error({ err }, `Failed to save balances enrichment `)
      throw err
    }
  }
}

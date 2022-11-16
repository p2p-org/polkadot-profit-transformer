import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { ExtrinsicModel } from '@/models/extrinsic.model'
import { BlockModel } from '@/models/block.model'
import { EventModel } from '@/models/event.model'
import { environment } from '@/environment'

@Service()
export class BlockProcessorDatabaseHelper {

  constructor(
    @Inject('knex') private readonly knex: Knex,
  ) { }


  async getUnprocessedBlocks(
    block_id?: number
  ): Promise<Array<BlockModel>> {

    const blocksRecords = BlockModel(this.knex)
      .select()
      .whereIsNull('metadata')
      .orderBy('block_id', 'asc')
      .limit(environment.BATCH_INSERT_CHUNK_SIZE)

    if (block_id) {
      blocksRecords.andWhere('entity_id', '>', block_id)
    }

    return await blocksRecords
  }


}

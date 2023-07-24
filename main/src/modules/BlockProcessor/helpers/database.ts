import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { ExtrinsicModel } from '@/models/extrinsic.model'
import { BlockModel } from '@/models/block.model'
import { TotalIssuance } from '@/models/total_issuance.model'
import { EventModel } from '@/models/event.model'
import { environment } from '@/environment'

const network = { network_id: environment.NETWORK_ID }
@Service()
export class BlockProcessorDatabaseHelper {

  constructor(
    @Inject('knex') private readonly knex: Knex,
  ) { }

  async getBlockById(blockId: number): Promise<BlockModel | null> {
    const blocksRecords = await BlockModel(this.knex)
      .select()
      .where({ block_id: blockId, ...network })

    return blocksRecords[0]
  }

  async saveBlock(trx: Knex.Transaction<any, any[]>, block: BlockModel): Promise<void> {
    await BlockModel(this.knex)
      .transacting(trx)
      .insert({ ...block, ...network, row_time: new Date() })
  }

  async saveTotalIssuance(trx: Knex.Transaction<any, any[]>, blockId: number, totalIssuance: string): Promise<void> {
    await TotalIssuance(this.knex)
      .transacting(trx)
      .insert({ block_id: blockId, total_issuance: totalIssuance, ...network, row_time: new Date() })
  }

  async saveEvent(trx: Knex.Transaction<any, any[]>, event: EventModel): Promise<void> {
    const eventForDb = {
      ...event,
      event: event.event.toJSON()
    }
    await EventModel(this.knex)
      .transacting(trx)
      .insert({ ...eventForDb, ...network, row_time: new Date() })
  }

  async saveExtrinsics(trx: Knex.Transaction<any, any[]>, extrinsic: ExtrinsicModel): Promise<void> {
    const strigifiedDataExtrinsic = {
      ...extrinsic,
      extrinsic: JSON.stringify(extrinsic.extrinsic),
    }
    await ExtrinsicModel(this.knex)
      .transacting(trx)
      .insert({ ...strigifiedDataExtrinsic, ...network, row_time: new Date() })
  }
}

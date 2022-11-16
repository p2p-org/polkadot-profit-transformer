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

  async saveBlock(trx: Knex.Transaction<any, any[]>, block: BlockModel): Promise<void> {
    await BlockModel(this.knex)
      .transacting(trx)
      .insert({ ...block, network_id: environment.NETWORK_ID })
  }

  async saveEvent(trx: Knex.Transaction<any, any[]>, event: EventModel): Promise<void> {
    const eventForDb = {
      ...event,
      event: event.event.toJSON()
    }
    await EventModel(this.knex)
      .transacting(trx)
      .insert({ ...eventForDb, network_id: environment.NETWORK_ID })
  }

  async saveExtrinsics(trx: Knex.Transaction<any, any[]>, extrinsic: ExtrinsicModel): Promise<void> {
    const strigifiedDataExtrinsic = {
      ...extrinsic,
      extrinsic: JSON.stringify(extrinsic.extrinsic),
    }
    await ExtrinsicModel(this.knex)
      .transacting(trx)
      .insert({ ...strigifiedDataExtrinsic, network_id: environment.NETWORK_ID })
  }
}

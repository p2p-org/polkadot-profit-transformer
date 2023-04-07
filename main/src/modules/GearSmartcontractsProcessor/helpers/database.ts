import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { Logger } from 'pino'
import { EventModel } from '@/models/event.model'
import { ExtrinsicModel } from '@/models/extrinsic.model'
import { environment } from '@/environment'
import { GearSmartcontractModel } from '@/models/gear_smartcontract.model'
import { GearSmartcontractMessageModel } from '@/models/gear_smartcontract_message.model'
import { DatabaseHelper } from '@/libs/database'
import { AccountModel } from '@/models/accounts.model'
import { encodeAccountIdToBlake2 } from '@/utils/crypt'

const network = { network_id: environment.NETWORK_ID }
@Service()
export class GearSmartcontractsDatabaseHelper extends DatabaseHelper {

  constructor(
    @Inject('knex') private readonly knex: Knex,
    @Inject('logger') private readonly logger: Logger,
  ) {
    super(knex)
  }

  public async getUnprocessedEvents(
    row_id?: number
  ): Promise<Array<EventModel>> {
    const records = EventModel(this.knex)
      .select()
      .where('section', 'gear')
      .orderBy('row_id', 'asc')
      .limit(environment.BATCH_INSERT_CHUNK_SIZE)

    if (row_id) {
      records.andWhere('row_id', '>', row_id)
    }

    return await records
  }

  public async getExtrinsicEvents(
    extrinsic: ExtrinsicModel,
    method?: Array<string>
  ): Promise<Array<EventModel>> {
    const records = EventModel(this.knex)
      .select()
      //.whereIn('event_id', extrinsic.ref_event_ids)
      .where('section', 'gear')
      .where('block_id', extrinsic.block_id)
      .orderBy('row_id', 'asc')

    if (method && method.length) {
      records.whereIn('method', method)
    }

    return await records
  }

  public async getUnprocessedExtrinsics(
    row_id?: number
  ): Promise<Array<ExtrinsicModel>> {
    const records = ExtrinsicModel(this.knex)
      .select()
      .where('section', 'gear')
      //.where('method', 'uploadProgram')
      .orderBy('row_id', 'asc')
      .limit(environment.BATCH_INSERT_CHUNK_SIZE)

    if (row_id) {
      records.andWhere('row_id', '>', row_id)
    }

    return await records
  }

  public async saveGearSmartcontract(data: GearSmartcontractModel): Promise<void> {
    try {
      await GearSmartcontractModel(this.knex)
        .insert({ ...data, ...network, row_time: new Date() })
        .onConflict(['program_id', 'network_id'])
        .merge()

      await this.saveAccount({ account_id: String(data.account_id), created_at_block_id: data.block_id })
    } catch (err) {
      this.logger.error({ err }, `Failed to save gear smart contract`)
      throw err
    }
  }

  public async saveGearSmartcontractMessage(data: GearSmartcontractMessageModel): Promise<void> {
    try {
      await GearSmartcontractMessageModel(this.knex)
        .insert({ ...data, ...network, row_time: new Date() })
        .onConflict(['extrinsic_id', 'network_id'])
        .merge()

      await this.saveAccount({ account_id: String(data.account_id), created_at_block_id: data.block_id })

    } catch (err) {
      this.logger.error({ err }, `Failed to save gear smart contract message`)
      throw err
    }
  }

  //TODO: remove from this module
  public async saveAccount(data: AccountModel): Promise<void> {
    data.blake2_hash = encodeAccountIdToBlake2(data.account_id)

    try {
      await AccountModel(this.knex)
        .insert({ ...data, ...network, row_time: new Date() })
    } catch (err) {
    }
  }
}

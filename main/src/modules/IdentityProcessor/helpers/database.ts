import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { Logger } from 'pino'
import { ProcessingStateModel } from '@/models/processing_status.model'
import { ENTITY } from '@/models/processing_task.model'
import { BlockModel } from '@/models/block.model'
import { EventModel } from '@/models/event.model'
import { ExtrinsicModel } from '@/models/extrinsic.model'
import { environment } from '@/environment'
import { IdentityModel } from '@/models/identity.model'

const network = { network_id: environment.NETWORK_ID }
@Service()
export class IdentityDatabaseHelper {

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

  public async getUnprocessedEvents(
    row_id?: number
  ): Promise<Array<EventModel>> {
    const records = EventModel(this.knex)
      .select()
      .where('section', 'system')
      .whereIn('method', ['NewAccount', 'KilledAccount'])
      .orderBy('row_id', 'asc')
      .limit(10)//environment.BATCH_INSERT_CHUNK_SIZE)

    if (row_id) {
      records.andWhere('row_id', '>', row_id)
    }

    return await records
  }

  public async getUnprocessedExtrinsics(
    row_id?: number
  ): Promise<Array<ExtrinsicModel>> {
    const records = ExtrinsicModel(this.knex)
      .select()
      .where('section', 'identity')
      .whereIn('method', ['clearIdentity', 'killIdentity', 'setFields', 'setIdentity', 'addSub', 'quitSub', 'removeSub', 'renameSub', 'setSubs'])
      .orderBy('row_id', 'asc')
      .limit(environment.BATCH_INSERT_CHUNK_SIZE)

    if (row_id) {
      records.andWhere('row_id', '>', row_id)
    }

    return await records
  }


  public async saveIdentity(data: IdentityModel, withoutOld: boolean=false, deep:number = 0): Promise<void> {
    if (deep > 10 ) return;
    try {
      const oldIdentity = withoutOld ? {} : await this.findIdentityByAccountId(data.account_id, data.parent_account_id)
      const updatedIdentity = { ...(oldIdentity ?? {}), ...data }
      if (updatedIdentity.account_id === updatedIdentity.parent_account_id) {
        delete updatedIdentity.parent_account_id;
      }
      await IdentityModel(this.knex)
        .insert({ ...updatedIdentity, ...network })
        .onConflict(['account_id', 'network_id'])
        .merge()

      //recursively update children
      const children = await IdentityModel(this.knex)
        .select()
        .where({ parent_account_id: data.account_id, ...network })
      if (!children || !children.length) {
        return;
      }
      for (const child of children) {
        const childIdentity = {
           ...child,
           display: updatedIdentity.display,
           legal: updatedIdentity.legal,
           web: updatedIdentity.web,
           riot: updatedIdentity.riot,
           email: updatedIdentity.email,
           twitter: updatedIdentity.twitter
        }
        await this.saveIdentity(childIdentity, true, deep+1);
      }
    } catch (err) {
      this.logger.error({ err }, `Failed to save identity enrichment `)
      throw err
    }
  }

  public async findIdentityByAccountId(accountId: string, parentAccountId: string | null = null, deep: number = 0): Promise<IdentityModel | undefined> {
    if (deep > 10 ) return;
    const result = await IdentityModel(this.knex)
      .where({ account_id: accountId, ...network })
      .first()

    if (!result && parentAccountId !== null && parentAccountId !== "0") {
      const parentResult = await this.findIdentityByAccountId(parentAccountId, null, deep+1); 
      return parentResult;
    } if (!result) {
      return undefined
    } else if (result.parent_account_id && result.parent_account_id !== accountId) {
      const parentResult = await this.findIdentityByAccountId(result.parent_account_id, null, deep+1); 
      return {...parentResult,...result};
    } 
    return result;
  }

}

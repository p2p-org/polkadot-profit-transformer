import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { environment } from '@/environment'

import { NominationPoolsEraModel } from '@/models/nomination_pools_era.model'
import { NominationPoolsIdentitiesModel } from '@/models/nomination_pools_identities.model'
import { NominationPoolsMembersModel } from '@/models/nomination_pools_members.model'

const network = { network_id: environment.NETWORK_ID }

@Service()
export class NominationPoolsProcessorDatabaseHelper {
  constructor(@Inject('knex') private readonly knex: Knex) {}

  async savePoolIdentity(trx: Knex.Transaction<any, any[]>, data: NominationPoolsIdentitiesModel): Promise<void> {
    data.pool_name = data.pool_name?.replace(/[^a-zA-Z0-9\s.,'\-]/g, '').trim()
    if (!data?.pool_name?.length) {
      data.pool_name = 'NA'
    }

    //console.log(data);
    await NominationPoolsIdentitiesModel(this.knex)
      .transacting(trx)
      .insert({ ...data, ...network, row_time: new Date() })
      .onConflict(['network_id', 'pool_id'])
      .merge()
  }

  async saveEraPoolData(trx: Knex.Transaction<any, any[]>, data: NominationPoolsEraModel): Promise<void> {
    //console.log(data);
    await NominationPoolsEraModel(this.knex)
      .transacting(trx)
      .insert({ ...data, ...network, row_time: new Date() })
  }

  async saveEraPoolMember(trx: Knex.Transaction<any, any[]>, data: NominationPoolsMembersModel): Promise<void> {
    //console.log(data);
    await NominationPoolsMembersModel(this.knex)
      .transacting(trx)
      .insert({ ...data, ...network, row_time: new Date() })
  }
}

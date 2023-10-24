import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { Logger } from 'pino'
import { ProcessingStateModel } from '@/models/processing_status.model'
import { ENTITY } from '@/models/processing_task.model'
import { EventModel } from '@/models/event.model'
import { ExtrinsicModel } from '@/models/extrinsic.model'
import { environment } from '@/environment'
import { IdentityModel } from '@/models/identities.model'
import { AccountModel } from '@/models/accounts.model'
import { encodeAccountIdToBlake2 } from '@/utils/crypt'
import { BalancesModel } from '@/models/balances.model'

const network = { network_id: environment.NETWORK_ID }
@Service()
export class IdentityDatabaseHelper {
  constructor(@Inject('knex') private readonly knex: Knex, @Inject('logger') private readonly logger: Logger) {}

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

  public async getUnprocessedEvents(row_id?: number): Promise<Array<EventModel>> {
    const records = EventModel(this.knex)
      .select()
      .where('section', 'system')
      .whereIn('method', ['NewAccount', 'KilledAccount'])
      .orderBy('row_id', 'asc')
      .limit(environment.BATCH_INSERT_CHUNK_SIZE)

    if (row_id) {
      records.andWhere('row_id', '>', row_id)
    }

    return await records
  }

  public async fillAccountsByExtrinsics(): Promise<void> {
    console.log('fillAccountsByExtrinsics', 'START')

    let offset = 0
    let done = false

    while (!done) {
      console.log(`fillAccountsByExtrinsics. Processing batch ${environment.BATCH_INSERT_CHUNK_SIZE} : offset : ${offset}`)
      const query = `
        WITH RankedSigners AS (
          SELECT
              "signer",
              "block_id",
              ROW_NUMBER() OVER (PARTITION BY "signer" ORDER BY "block_id") AS rn
          FROM
              extrinsics
        )
        SELECT "signer", "block_id"
        FROM RankedSigners
        WHERE rn = 1
        LIMIT ${environment.BATCH_INSERT_CHUNK_SIZE}
        OFFSET ${offset}
      `

      const data = await this.knex.raw(query)

      if (data.rows.length === 0) {
        done = true
      } else {
        for (const row of data.rows) {
          console.log({
            account_id: String(row.signer),
            created_at_block_id: row.block_id,
          })
          await this.saveAccount({
            account_id: String(row.signer),
            created_at_block_id: row.block_id,
          })
        }
        offset += environment.BATCH_INSERT_CHUNK_SIZE
      }
    }
    console.log('fillAccountsByExtrinsics', 'DONE')
  }

  public async fixMissedBlake2HashAccounts(): Promise<void> {
    let offset = 0

    while (true) {
      const records = AccountModel(this.knex)
        .select()
        .whereNull('blake2_hash')
        .orderBy('row_id', 'asc')
        .offset(offset)
        .limit(environment.BATCH_INSERT_CHUNK_SIZE)

      const accounts = await records
      if (!accounts || !accounts.length) {
        break
      }

      for (const account of accounts) {
        this.logger.info({
          event: 'IdentityDatabaseHelper.fixUnprocessedBlake2Accounts',
          message: 'Encode blake2 account',
          account_id: account.account_id,
          row_id: account.row_id,
        })

        await AccountModel(this.knex)
          .update({ blake2_hash: encodeAccountIdToBlake2(account.account_id) })
          .where({ row_id: account.row_id })
      }

      offset += environment.BATCH_INSERT_CHUNK_SIZE
    }

    this.logger.info({
      event: 'IdentityDatabaseHelper.fixUnprocessedBlake2Accounts',
      message: 'All accounts have been encoded',
    })
  }

  public async fixMissedAccountsIdsForBalances(): Promise<void> {
    let offset = 0

    while (true) {
      console.log(`fixMissedAccountsIdsForBalances. Processing batch ${environment.BATCH_INSERT_CHUNK_SIZE} : offset : ${offset}`)
      const balanceChunk = await this.knex('balances')
        .whereNull('account_id')
        .whereNotNull('blake2_hash')
        .offset(offset)
        .limit(environment.BATCH_INSERT_CHUNK_SIZE)

      if (!balanceChunk || !balanceChunk.length) {
        break
      }

      for (const balance of balanceChunk) {
        const account = await this.getAccountByBlake2Hash(balance.blake2_hash)
        if (account) {
          await this.knex('balances').where({ row_id: balance.row_id }).update({ account_id: account.account_id })
        }
      }

      offset += environment.BATCH_INSERT_CHUNK_SIZE
    }
    this.logger.info({
      event: 'IdentityDatabaseHelper.fixMissedAccountsIdsForBalances',
      message: 'All accounts for balances was found',
    })
  }

  public async getAccountByBlake2Hash(blake2Hash: string): Promise<AccountModel> {
    return this.knex('accounts')
      .where({ blake2_hash: blake2Hash, ...network })
      .first()
  }

  public async fixHexDisplay(): Promise<void> {
    const hex2str = (hex: string): string => {
      let str = ''
      for (let i = 0; i < hex.length; i += 2) {
        str += String.fromCharCode(parseInt(hex.substr(i, 2), 16))
      }
      return str.replace(/[^a-zA-Z0-9_\-\. ]/g, '').trim()
    }

    const records = await IdentityModel(this.knex).select(['row_id', 'display']).orderBy('row_id', 'asc').limit(50000)

    for (const record of records) {
      let newDisplay = ''
      if (record.display?.match(/^0x[0-9|a-f|A-F]+$/g) && record.display.length > 8) {
        newDisplay = hex2str(record.display.substr(2))
      } else if (record.display?.match(/^[0-9|a-f|A-F]+$/g) && record.display.length > 8) {
        newDisplay = hex2str(record.display)
      }
      if (record.display !== newDisplay && newDisplay !== '') {
        //console.log(record.display + ':' + newDisplay)
        await IdentityModel(this.knex).update({ display: newDisplay }).where({ row_id: record.row_id })
      }
    }
  }

  public async saveAccount(data: AccountModel): Promise<void> {
    try {
      data.blake2_hash = encodeAccountIdToBlake2(data.account_id)

      await AccountModel(this.knex)
        .insert({ ...data, ...network, row_time: new Date() })
        .onConflict(['account_id', 'network_id'])
        .merge()
    } catch (err) {
      this.logger.error({ err }, 'Failed to save identity enrichment')
    }
  }

  public async getUnprocessedExtrinsics(row_id?: number): Promise<Array<ExtrinsicModel>> {
    const records = ExtrinsicModel(this.knex)
      .select()
      .where('section', 'identity')
      .whereIn('method', [
        'clearIdentity',
        'killIdentity',
        'setFields',
        'setIdentity',
        'addSub',
        'quitSub',
        'removeSub',
        'renameSub',
        'setSubs',
      ])
      .orderBy('row_id', 'asc')
      .limit(environment.BATCH_INSERT_CHUNK_SIZE)

    if (row_id) {
      records.andWhere('row_id', '>', row_id)
    }

    return await records
  }

  public async saveIdentity(data: IdentityModel, withoutOld = false, deep = 0): Promise<void> {
    if (deep > 10) return
    try {
      const oldIdentity = withoutOld ? {} : await this.findIdentityByAccountId(data.account_id, data.parent_account_id)
      const updatedIdentity = { ...(oldIdentity ?? {}), ...data }
      if (updatedIdentity.account_id === updatedIdentity.parent_account_id) {
        delete updatedIdentity.parent_account_id
      }
      delete updatedIdentity.row_id

      await IdentityModel(this.knex)
        .insert({ ...updatedIdentity, ...network, row_time: new Date() })
        .onConflict(['account_id', 'network_id'])
        .merge()

      //recursively update children
      const children = await IdentityModel(this.knex)
        .select()
        .where({ parent_account_id: data.account_id, ...network })
      if (!children || !children.length) {
        return
      }
      for (const child of children) {
        const childIdentity = {
          ...child,
          display: updatedIdentity.display,
          legal: updatedIdentity.legal,
          web: updatedIdentity.web,
          riot: updatedIdentity.riot,
          email: updatedIdentity.email,
          twitter: updatedIdentity.twitter,
        }
        await this.saveIdentity(childIdentity, true, deep + 1)
      }
    } catch (err) {
      this.logger.error({ err }, `Failed to save identity enrichment `)
      throw err
    }
  }

  public async findIdentityByAccountId(
    accountId: string,
    parentAccountId: string | null = null,
    deep = 0,
  ): Promise<IdentityModel | undefined> {
    if (deep > 10) return
    const result = await IdentityModel(this.knex)
      .where({ account_id: accountId, ...network })
      .first()

    if (!result && parentAccountId !== null && parentAccountId !== '0') {
      return await this.findIdentityByAccountId(parentAccountId, null, deep + 1)
    }
    if (!result) {
      return undefined
    } else if (result.parent_account_id && result.parent_account_id !== accountId) {
      return await this.findIdentityByAccountId(result.parent_account_id, null, deep + 1)
      //return { ...parentResult, ...result };
    }
    return result
  }
}

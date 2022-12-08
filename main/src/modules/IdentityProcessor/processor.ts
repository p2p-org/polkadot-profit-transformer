import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { Logger } from 'pino'
import { EventModel } from '@/models/event.model'
import { IdentityModel } from '@/models/identity.model'
import { ExtrinsicModel } from '@/models/extrinsic.model'
import { IdentityDatabaseHelper } from './helpers/database'

export enum JudgementStatus {
  REQUESTED = 'requested',
  GIVEN = 'given',
  UNREQUESTED = 'unrequested',
}


@Service()
export class IdentityProcessorService {

  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('knex') private readonly knex: Knex,
    private readonly databaseHelper: IdentityDatabaseHelper,
  ) {

    console.log("I'm loaded")
  }

  public async processEvent(event: EventModel): Promise<void> {
    this.logger.info({
      event: 'IdentityProcessor.processEvent',
      data: event
    })

    switch (event.method) {
      case 'NewAccount':
        this.logger.info({ block_id: event.block_id }, `Process enrichment NewAccount`)
        await this.onNewAccount(event)
        break
      case 'KilledAccount':
        this.logger.info({ block_id: event.block_id }, `Process enrichment KilledAccount`)
        await this.onKilledAccount(event)
        break
      /*
    case 'JudgementRequested':
      this.logger.info({ block_id: event.block_id }, `Process enrichment JudgementRequested`)
      await this.onJudgementEvent({ event, status: JudgementStatus.REQUESTED })
      break
    case 'JudgementGiven':
      this.logger.info({ block_id: event.block_id }, `Process enrichment JudgementGiven`)
      await this.onJudgementEvent({ event, status: JudgementStatus.GIVEN })
      break
    case 'JudgementUnrequested':
      this.logger.info({ block_id: event.block_id }, `Process enrichment JudgementUnrequested`)
      await this.onJudgementEvent({ event, status: JudgementStatus.UNREQUESTED })
      break
      */
      default:
        this.logger.error({
          event: 'IdentityProcessor.processEvent',
          message: `failed to process undefined entry with event type "${event.event}"`
        })
        break
    }
  }

  public async onNewAccount(event: EventModel): Promise<void> {
    // console.log('onNewAccount event', event)

    return this.databaseHelper.saveIdentity({
      account_id: event.event.data[0].toString(),
      created_at_block_id: event.block_id,
    })
  }

  public async onKilledAccount(event: EventModel): Promise<void> {
    // console.log('onKilledAccount event', event)

    return this.databaseHelper.saveIdentity({
      account_id: event.event.data[0].toString(),
      killed_at_block_id: event.block_id,
    })
  }


  public async processExtrinsic(extrinsic: ExtrinsicModel): Promise<void> {
    this.logger.info({
      event: 'IdentityProcessor.processExtrinsic',
      data: extrinsic
    })

    switch (extrinsic.method) {
      //case 'clearIdentity':
      //case 'killIdentity':
      case 'setFields':
      case 'setIdentity':
        await this.updateAccountIdentity(extrinsic)
        break
      case 'addSub':
        await this.addSub(extrinsic)
        break
      case 'setSubs':
        await this.setSubs(extrinsic)
        break
      case 'removeSub':
        await this.removeSub(extrinsic)
        break
      case 'quitSub':
        await this.quitSub(extrinsic)
        break
      case 'renameSubs':
        // TODO: discover what is sub name
        break
      default:
        this.logger.error({
          event: 'IdentityProcessor.processExtrinsic',
          message: `failed to process undefined entry with extrnisic type "${extrinsic.method}"`
        })
    }
  }

  public async updateAccountIdentity(extrinsic: ExtrinsicModel): Promise<void> {
    // console.log('updateAccountIdentity extrinsic', extrinsic)

    const account_id = extrinsic.signer?.toString()

    if (!account_id) {
      this.logger.error({
        event: 'IdentityProcessor.updateAccountIdentity',
        message: 'IdentityProcessor no account_id found for extrinsic',
        extrinsic,
      })
      return
    }

    const identityRaw = extrinsic.extrinsic.args

    const getValueOfField = (identityRaw: any, field: string): string => {
      if (identityRaw.info && identityRaw.info[field]) {
        const value = identityRaw.info[field]
        if (typeof (value) === 'string' && value === 'None') { return '' }
        if (typeof (value) === 'object' && value.raw) { return value.raw }
        if (typeof (value) === 'object' && value.Raw) { return value.Raw }
      }
      return ''
    }
    
    const identity: IdentityModel = {
      account_id,
    };

    ['display', 'legal', 'web', 'riot', 'email', 'twitter'].forEach(item=>{
      const value = getValueOfField(identityRaw, item);
      if (value.trim() !== '') {
        //@ts-ignore
        identity[item] = value;
      }
    });
    console.log("identity: ", identity);

    return await this.databaseHelper.saveIdentity(identity);
  }

  public async addSub(extrinsic: ExtrinsicModel): Promise<void> {
    console.log("extrinsic.extrinsic", extrinsic.extrinsic)
    const account_id = this.getSubAccount(extrinsic)
    if (!account_id) {
      return
    }

    const parent_account_id = extrinsic.signer || ''
    return this.databaseHelper.saveIdentity({ account_id, parent_account_id })
  }

  public async setSubs(extrinsic: ExtrinsicModel): Promise<any> {
    console.log("extrinsic.extrinsic.args", extrinsic.extrinsic.args);
    const parent_account_id = extrinsic.signer || ''
    const subs = extrinsic.extrinsic?.args?.subs
    if (!subs) return
    return Promise.all(
      subs.map(([account_id]: string) =>
        this.databaseHelper.saveIdentity({
          account_id: account_id.toString(),
          parent_account_id,
        }),
      ),
    )
  }

  public async removeSub(extrinsic: ExtrinsicModel): Promise<any> {
    const account_id = this.getSubAccount(extrinsic)
    if (!account_id) {
      return null
    }

    return this.databaseHelper.saveIdentity({ account_id, parent_account_id: null })
  }

  /**
   * Remove the sender as a sub-account.
   */
  public async quitSub(extrinsic: ExtrinsicModel): Promise<any> {
    // console.log('quitSub extrinsic', extrinsic)

    const account_id = extrinsic.signer!.toString()
    return this.databaseHelper.saveIdentity({ account_id, parent_account_id: null })
  }


  private getSubAccount(extrinsic: ExtrinsicModel): string | null {
    if (extrinsic.extrinsic?.args?.length) {
      return extrinsic.extrinsic.args[0]
    } else if (extrinsic.extrinsic?.args?.sub?.id) {
      return extrinsic.extrinsic.args.sub.id
    } else if (extrinsic.extrinsic?.args?.sub?.Id) {
      return extrinsic.extrinsic.args.sub.Id
    } else if (extrinsic.extrinsic?.args?.sub) {
      return extrinsic.extrinsic.args.sub
    } else {
      this.logger.error({
        event: 'IdentityProcessor.addSub',
        message: 'Couldnot get subaccount',
        extrinsic,
      })
      return null
    }
  }
}



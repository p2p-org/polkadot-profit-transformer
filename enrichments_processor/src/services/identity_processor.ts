import { FastifyInstance } from 'fastify'
import {
  IApplication,
  IIdentityProcessorService,
  IEvent,
  IExtrinsicsEntry,
  IExtrinsic,
  IEnrichmentEntry,
  ISubsEntry,
  JudgementStatus
} from './identity_processor.types'
import { Option } from '@polkadot/types'
import { Registration } from '@polkadot/types/interfaces/identity'

const {
  environment: { KAFKA_PREFIX }
} = require('../environment')

/**
 * Provides identity enrichment processing service
 */
class IdentityProcessorService implements IIdentityProcessorService {
  private readonly app: FastifyInstance & IApplication

  constructor(app: FastifyInstance & IApplication) {
    this.app = app
    const { polkadotConnector, kafkaProducer } = this.app

    if (!polkadotConnector) {
      throw new Error('cant get .polkadotConnector from fastify app.')
    }

    if (!kafkaProducer) {
      throw new Error('cant get .kafkaProducer from fastify app.')
    }
  }

  async processEvent(event: IEvent) {
    switch (event.event) {
      case 'NewAccount':
        this.app.log.debug(`Block ${event.block_id}: Process enrichment NewAccount`)
        return this.onNewAccount(event)
      case 'KilledAccount':
        this.app.log.debug(`Block ${event.block_id}: Process enrichment KilledAccount`)
        return this.onKilledAccount(event)
      case 'JudgementRequested':
        this.app.log.debug(`Block ${event.block_id}: Process enrichment JudgementRequested`)
        return this.onJudgementEvent({ event, status: JudgementStatus.REQUESTED })
      case 'JudgementGiven':
        this.app.log.debug(`Block ${event.block_id}: Process enrichment JudgementGiven`)
        return this.onJudgementEvent({ event, status: JudgementStatus.GIVEN })
      case 'JudgementUnrequested':
        this.app.log.debug(`Block ${event.block_id}: Process enrichment JudgementUnrequested`)
        return this.onJudgementEvent({ event, status: JudgementStatus.UNREQUESTED })
      default:
        this.app.log.error(`failed to process undefined entry with event type "${event.event}"`)
    }
  }

  async onNewAccount(event: IEvent) {
    return this.pushEnrichment(event.event_id, {
      account_id: event.account_id,
      created_at: event.block_id
    })
  }

  async onKilledAccount(event: IEvent) {
    return this.pushEnrichment(event.event_id, {
      account_id: event.account_id,
      killed_at: event.block_id
    })
  }

  async onJudgementEvent({ event, status }: { event: IEvent; status: JudgementStatus }) {
    const data = JSON.parse(event.data)
    const enrichmentData = {
      account_id: event.account_id,
      judgement_status: status,
      registrar_index: parseInt(data[1].RegistrarIndex, 16)
    }
    return this.pushEnrichment(event.event_id, enrichmentData)
  }

  async processExtrinsics({ extrinsics }: IExtrinsicsEntry) {
    const isValidIdentityExtrinsic = (extrinsic: IExtrinsic) => {
      const identityMethods = ['clearIdentity', 'killIdentity', 'setFields', 'setIdentity']
      return identityMethods.includes(extrinsic.method) && extrinsic.signer
    }

    const isValidSubsExtrinsic = (extrinsic: IExtrinsic) => {
      const subsMethods = ['addSub', 'quitSub', 'removeSub', 'renameSub', 'setSubs']
      return subsMethods.includes(extrinsic.method) && extrinsic.signer
    }

    for (const extrinsic of extrinsics) {
      if (isValidIdentityExtrinsic(extrinsic)) {
        return this.updateAccountIdentity(extrinsic)
      }

      if (isValidSubsExtrinsic(extrinsic)) {
        return this.updateSubAccounts(extrinsic)
      }
    }
  }

  async updateAccountIdentity({ id: key, signer: accountId }: IExtrinsic) {
    this.app.log.debug(`Process updateAccountIdentity with id ${key}`)

    const identityRaw: Option<Registration> = await this.getIdentity(accountId)

    if (identityRaw.isEmpty || identityRaw.isNone) {
      return this.pushEnrichment(key, {
        account_id: accountId,
        display: '',
        legal: '',
        web: '',
        riot: '',
        email: '',
        twitter: ''
      })
    }

    const getValueOfField = (identityRaw: Option<Registration>, field: string) => {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      return identityRaw.toHuman().info[field]?.Raw || ''
    }

    return this.pushEnrichment(key, {
      account_id: accountId,
      display: getValueOfField(identityRaw, 'display'),
      legal: getValueOfField(identityRaw, 'legal'),
      web: getValueOfField(identityRaw, 'web'),
      riot: getValueOfField(identityRaw, 'riot'),
      email: getValueOfField(identityRaw, 'email'),
      twitter: getValueOfField(identityRaw, 'twitter')
    })
  }

  async updateSubAccounts(extrinsic: IExtrinsic) {
    this.app.log.debug(`Process updateSubAccounts`)

    const { method, args } = extrinsic

    const sendToPushEnrichmentSubs = ({ key, accountId, rootAccountId }: ISubsEntry) => {
      return this.pushEnrichment(key, {
        account_id: accountId,
        root_account_id: rootAccountId
      })
    }

    /**
     * Adds the given account to the sender's subs.
     */
    const addSub = async (extrinsic: IExtrinsic) => {
      const [rawArg] = args
      const accountId = typeof rawArg === 'string' ? rawArg : rawArg.id
      const rootAccountId = extrinsic.signer
      const key = extrinsic.id
      return sendToPushEnrichmentSubs({ key, accountId, rootAccountId })
    }

    /**
     * Set the sub-accounts of the sender.
     */
    const setSubs = async (extrinsic: IExtrinsic) => {
      const [rawSubs] = args
      const rootAccountId = extrinsic.signer
      const key = extrinsic.id
      return Promise.all(
        rawSubs.map(([accountId]: string, index: number) =>
          sendToPushEnrichmentSubs({
            key: `${key}_${index}`,
            accountId,
            rootAccountId
          })
        )
      )
    }

    /**
     * Remove the given account from the sender's subs.
     *
     * extrinsic.args could be of two types:
     *
     * ["14TMfeiXiV7oG522eVuKBYi2VsgSMzjFiJYhiXPmbBNzFRQZ"]
     * or
     * [{ "id": "13SjEpJXxro4HKDLuxjfg3oYP8zpS8E78ZdoabUF4sN4B3hJ"}]
     *
     */
    const removeSub = async (extrinsic: IExtrinsic): Promise<void> => {
      const [rawArg] = extrinsic.args
      const key = extrinsic.id
      const accountId = typeof rawArg === 'string' ? rawArg : rawArg.id
      return sendToPushEnrichmentSubs({ key, accountId, rootAccountId: '' })
    }

    /**
     * Remove the sender as a sub-account.
     */
    const quitSub = async (extrinsic: IExtrinsic): Promise<void> => {
      const key = extrinsic.id
      const accountId = extrinsic.signer
      return sendToPushEnrichmentSubs({ key, accountId, rootAccountId: '' })
    }

    switch (method) {
      case 'addSub':
        await addSub(extrinsic)
        break
      case 'setSubs':
        await setSubs(extrinsic)
        break
      case 'removeSub':
        await removeSub(extrinsic)
        break
      case 'quitSub':
        await quitSub(extrinsic)
        break
      case 'renameSubs':
        // 2do discover what is sub name
        break
      default:
        return
    }
  }

  // TODO - research why this doesn't work
  // async getIdentity(accountId: string): Promise<Option<Registration>> {

  async getIdentity(accountId: string): Promise<any> {
    const { polkadotConnector } = this.app
    return polkadotConnector.query.identity.identityOf(accountId)
  }

  async pushEnrichment(key: string, data: IEnrichmentEntry): Promise<void> {
    const { kafkaProducer } = this.app

    await kafkaProducer
      .send({
        topic: KAFKA_PREFIX + '_IDENTITY_ENRICHMENT_DATA',
        messages: [
          {
            key: key,
            value: JSON.stringify(data)
          }
        ]
      })
      .catch((error) => {
        this.app.log.error(`failed to push identity enrichment: `, error)
      })
  }
}

module.exports = {
  IdentityProcessorService: IdentityProcessorService
}

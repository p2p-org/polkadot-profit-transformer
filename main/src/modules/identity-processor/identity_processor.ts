import {
  IIdentityProcessorService,
  IEvent,
  IExtrinsicsEntry,
  IExtrinsic,
  IEnrichmentEntry,
  ISubsEntry,
  JudgementStatus,
} from './identity_processor.types'
import { Option } from '@polkadot/types'
import { Registration } from '@polkadot/types/interfaces/identity'
import { KafkaModule } from '../../modules/kafka.module'
import { PolkadotModule } from '../../modules/polkadot.module'
import { LoggerModule, ILoggerModule } from '../../modules/logger.module'

/**
 * Provides identity enrichment processing service
 */
class IdentityProcessorService implements IIdentityProcessorService {
  private static instance: IdentityProcessorService
  private readonly kafka: KafkaModule = KafkaModule.inject()
  private readonly polkadotApi: PolkadotModule = PolkadotModule.inject()
  private readonly logger: ILoggerModule = LoggerModule.inject()

  constructor() {
    if (IdentityProcessorService.instance) {
      return IdentityProcessorService.instance
    }

    IdentityProcessorService.instance = this
  }

  async processEvent(event: IEvent): Promise<void> {
    switch (event.event) {
      case 'NewAccount':
        this.logger.info({ block_id: event.block_id }, `Process enrichment NewAccount`)
        return this.onNewAccount(event)
      case 'KilledAccount':
        this.logger.info({ block_id: event.block_id }, `Process enrichment KilledAccount`)
        return this.onKilledAccount(event)
      case 'JudgementRequested':
        this.logger.info({ block_id: event.block_id }, `Process enrichment JudgementRequested`)
        return this.onJudgementEvent({ event, status: JudgementStatus.REQUESTED })
      case 'JudgementGiven':
        this.logger.info({ block_id: event.block_id }, `Process enrichment JudgementGiven`)
        return this.onJudgementEvent({ event, status: JudgementStatus.GIVEN })
      case 'JudgementUnrequested':
        this.logger.info({ block_id: event.block_id }, `Process enrichment JudgementUnrequested`)
        return this.onJudgementEvent({ event, status: JudgementStatus.UNREQUESTED })
      default:
        this.logger.error({ block_id: event.block_id }, `failed to process undefined entry with event type "${event.event}"`)
    }
  }

  async onNewAccount(event: IEvent): Promise<void> {
    return this.pushEnrichment(event.event_id, {
      account_id: event.account_id,
      created_at: event.block_id,
    })
  }

  async onKilledAccount(event: IEvent): Promise<void> {
    return this.pushEnrichment(event.event_id, {
      account_id: event.account_id,
      killed_at: event.block_id,
    })
  }

  async onJudgementEvent({ event, status }: { event: IEvent; status: JudgementStatus }): Promise<void> {
    const data = JSON.parse(event.data)
    const enrichmentData = {
      account_id: event.account_id,
      judgement_status: status,
      registrar_index: parseInt(data[1].RegistrarIndex, 16),
    }
    return this.pushEnrichment(event.event_id, enrichmentData)
  }

  async processExtrinsics({ extrinsics }: IExtrinsicsEntry): Promise<void> {
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
        await this.updateAccountIdentity(extrinsic)
      }

      if (isValidSubsExtrinsic(extrinsic)) {
        await this.updateSubAccounts(extrinsic)
      }
    }
  }

  async updateAccountIdentity({ id: key, signer: accountId }: Pick<IExtrinsic, 'id' | 'signer'>): Promise<void> {
    this.logger.info({ key, accountId }, `Process updateAccountIdentity with id ${key}`)
    const identityRaw: Option<Registration> = await this.polkadotApi.getIdentity(accountId)

    if (identityRaw.isEmpty || identityRaw.isNone) {
      return this.pushEnrichment(key, {
        account_id: accountId,
        display: '',
        legal: '',
        web: '',
        riot: '',
        email: '',
        twitter: '',
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
      twitter: getValueOfField(identityRaw, 'twitter'),
    })
  }

  sendToPushEnrichmentSubs({ key, accountId, rootAccountId }: ISubsEntry): Promise<void> {
    return this.pushEnrichment(key, {
      account_id: accountId,
      root_account_id: rootAccountId,
    })
  }

  async updateSubAccounts(extrinsic: IExtrinsic): Promise<void> {
    this.logger.trace(`Process updateSubAccounts`)

    const { method, args } = extrinsic

    /**
     * Adds the given account to the sender's subs.
     */
    const addSub = async (extrinsic: IExtrinsic) => {
      const [rawArg] = args
      const accountId = typeof rawArg === 'string' ? rawArg : rawArg.id
      const rootAccountId = extrinsic.signer
      const key = extrinsic.id
      return this.sendToPushEnrichmentSubs({ key, accountId, rootAccountId })
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
          this.sendToPushEnrichmentSubs({
            key: `${key}_${index}`,
            accountId,
            rootAccountId,
          }),
        ),
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
      return this.sendToPushEnrichmentSubs({ key, accountId, rootAccountId: '' })
    }

    /**
     * Remove the sender as a sub-account.
     */
    const quitSub = async (extrinsic: IExtrinsic): Promise<void> => {
      const key = extrinsic.id
      const accountId = extrinsic.signer
      return this.sendToPushEnrichmentSubs({ key, accountId, rootAccountId: '' })
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

  async pushEnrichment(key: string, data: IEnrichmentEntry): Promise<void> {
    try {
      await this.kafka.sendEnrichmentData(key, data)
    } catch (err) {
      this.logger.error({ err }, `Failed to push identity enrichment `)
    }
  }
}

export default IdentityProcessorService

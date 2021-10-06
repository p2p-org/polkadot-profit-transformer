import { EventModel } from './../../apps/common/infra/postgresql/models/event.model'
import { Logger } from './../../apps/common/infra/logger/logger'
import { PolkadotRepository } from 'apps/common/infra/polkadotapi/polkadot.repository'
import { IdentityRepository } from 'apps/common/infra/postgresql/identity.repository'
import { JudgementStatus } from './identity_processor.types'
import { ExtrinsicModel } from 'apps/common/infra/postgresql/models/extrinsic.model'
import { Registration } from '@polkadot/types/interfaces'

export type IdentityProcessor = ReturnType<typeof IdentityProcessor>

export const IdentityProcessor = (args: {
  polkadotRepository: PolkadotRepository
  identityRepository: IdentityRepository
  logger: Logger
}) => {
  const { polkadotRepository, identityRepository, logger } = args

  const saveEnrichment = async <T extends { account_id: string }>(data: T): Promise<void> => {
    try {
      const oldIdentity = await identityRepository.findByAccountId(data.account_id)
      const updatedIdentity = { ...(oldIdentity ?? {}), ...data }
      await identityRepository.save(updatedIdentity)
    } catch (err) {
      logger.error({ err }, `Failed to save identity enrichment `)
      throw err
    }
  }

  const onNewAccount = async (event: EventModel): Promise<void> => {
    return saveEnrichment({
      account_id: event.data[0]['AccountId'],
      created_at: event.block_id,
    })
  }

  const onKilledAccount = async (event: EventModel): Promise<void> => {
    return saveEnrichment({
      account_id: event.data[0]['AccountId'],
      killed_at: event.block_id,
    })
  }

  const onJudgementEvent = async ({ event, status }: { event: EventModel; status: JudgementStatus }): Promise<void> => {
    const data = JSON.parse(event.data)
    const enrichmentData = {
      account_id: event.data[0]['AccountId'],
      judgement_status: status,
      registrar_index: parseInt(data[1]['RegistrarIndex'], 16),
    }
    return saveEnrichment(enrichmentData)
  }

  // identity extrinsics processing functions
  const updateAccountIdentity = async (extrinsic: ExtrinsicModel): Promise<void> => {
    const account_id = extrinsic.signer

    if (!account_id) throw Error('IdentityProcessor no account_id found for extrinsic' + JSON.stringify(extrinsic))

    const identityRaw: Registration = await polkadotRepository.getIdentity(account_id)
    if (!identityRaw)
      throw Error(
        'IdentityProcessor updateAccountIdentity error: no identity found in polkadot.repository.getIdentity for account_id = ' +
          account_id,
      )

    const getValueOfField = (identityRaw: Registration, field: string) => {
      return identityRaw.info.get(field)
    }

    return await saveEnrichment({
      account_id,
      display: getValueOfField(identityRaw, 'display'),
      legal: getValueOfField(identityRaw, 'legal'),
      web: getValueOfField(identityRaw, 'web'),
      riot: getValueOfField(identityRaw, 'riot'),
      email: getValueOfField(identityRaw, 'email'),
      twitter: getValueOfField(identityRaw, 'twitter'),
    })
  }

  const updateSubAccounts = async (extrinsic: ExtrinsicModel): Promise<void> => {
    logger.trace(`Process updateSubAccounts` + JSON.stringify(extrinsic))

    const { method, args } = extrinsic

    /**
     * Adds the given account to the sender's subs.
     */
    const addSub = async (extrinsic: ExtrinsicModel) => {
      const [rawArg] = args
      const account_id = typeof rawArg === 'string' ? rawArg : rawArg.id
      const root_account_id = extrinsic.signer
      return saveEnrichment({ account_id, root_account_id })
    }

    /**
     * Set the sub-accounts of the sender.
     */
    const setSubs = async (extrinsic: ExtrinsicModel) => {
      const [rawSubs] = args
      const root_account_id = extrinsic.signer
      return Promise.all(
        rawSubs.map(([account_id]: string) =>
          saveEnrichment({
            account_id,
            root_account_id,
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
    const removeSub = async (extrinsic: ExtrinsicModel): Promise<void> => {
      const [rawArg] = extrinsic.args
      const account_id = typeof rawArg === 'string' ? rawArg : rawArg.id
      return saveEnrichment({ account_id, root_acccount_id: null })
    }

    /**
     * Remove the sender as a sub-account.
     */
    const quitSub = async (extrinsic: ExtrinsicModel): Promise<void> => {
      const account_id = extrinsic.signer!
      return saveEnrichment({ account_id, root_account_id: null })
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

  return {
    processEvent: async (event: EventModel) => {
      switch (event.method) {
        case 'NewAccount':
          logger.info({ block_id: event.block_id }, `Process enrichment NewAccount`)
          await onNewAccount(event)
          break
        case 'KilledAccount':
          logger.info({ block_id: event.block_id }, `Process enrichment KilledAccount`)
          await onKilledAccount(event)
          break
        case 'JudgementRequested':
          logger.info({ block_id: event.block_id }, `Process enrichment JudgementRequested`)
          await onJudgementEvent({ event, status: JudgementStatus.REQUESTED })
          break
        case 'JudgementGiven':
          logger.info({ block_id: event.block_id }, `Process enrichment JudgementGiven`)
          await onJudgementEvent({ event, status: JudgementStatus.GIVEN })
          break
        case 'JudgementUnrequested':
          logger.info({ block_id: event.block_id }, `Process enrichment JudgementUnrequested`)
          await onJudgementEvent({ event, status: JudgementStatus.UNREQUESTED })
          break
        default:
          logger.error({ block_id: event.block_id }, `failed to process undefined entry with event type "${event.event}"`)
          break
      }
    },
    processIdentityExtrinsics: async (extrinsic: ExtrinsicModel): Promise<void> => {
      await updateAccountIdentity(extrinsic)
    },
    processSubIdentityExtrinsics: async (extrinsic: ExtrinsicModel): Promise<void> => {
      await updateSubAccounts(extrinsic)
    },
  }
}

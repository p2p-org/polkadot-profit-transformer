import IdentityProcessorService from './identity_processor'
import { PolkadotModule } from '../../modules/polkadot.module'
import { LoggerModule } from '../../modules/logger.module'
import { KafkaModule } from './../../modules/kafka.module'
import { IEnrichmentEntry, IEvent, IExtrinsic, IExtrinsicsEntry, JudgementStatus } from './identity_processor.types'

jest.mock('../../modules/polkadot.module')
jest.mock('../../modules/logger.module')
jest.mock('../../modules/kafka.module')

PolkadotModule.inject = jest.fn(() => new PolkadotModule())
LoggerModule.inject = jest.fn(() => new LoggerModule())
KafkaModule.inject = jest.fn(() => new KafkaModule())

KafkaModule.prototype.sendEnrichmentData = jest.fn()

PolkadotModule.prototype.getIdentity = jest.fn(async (account_id: string) => {
  if (account_id === 'isEmpty') {
    return {
      isEmpty: true
    }
  }
  return {
    isEmpty: false,
    toHuman: () => ({
      info: {
        display: { Raw: 'display' },
        legal: { Raw: 'legal' },
        web: { Raw: 'web' },
        riot: { Raw: 'riot' },
        email: { Raw: 'email' },
        twitter: { Raw: 'twitter' }
      }
    })
  }
})

const event: IEvent = {
  account_id: 'account_id',
  block_id: 1,
  event: 'event',
  event_id: 'event_id',
  data: '["12345",{"RegistrarIndex":123}]'
}

describe('Identity Processor service', () => {
  let identityProcessorService: IdentityProcessorService

  beforeEach(() => {
    identityProcessorService = new IdentityProcessorService()
  })

  it('constructor', async () => {
    expect(identityProcessorService).toBeInstanceOf(IdentityProcessorService)
  })

  it('pushEnrichment', async () => {
    const entry: IEnrichmentEntry = {
      account_id: '1',
      root_account_id: '2',
      display: '3',
      legal: '4',
      web: '5',
      riot: '6',
      email: '7',
      twitter: '8',
      judgement_status: JudgementStatus.REQUESTED,
      registrar_index: 1,
      created_at: 123456,
      killed_at: 67890
    }
    await identityProcessorService.pushEnrichment('test', entry)

    expect(KafkaModule.prototype.sendEnrichmentData).toBeCalledWith('test', entry)
  })
})

describe('Push enrichments methods', () => {
  let identityProcessorService: IdentityProcessorService

  beforeEach(() => {
    IdentityProcessorService.prototype.pushEnrichment = jest.fn()
    identityProcessorService = new IdentityProcessorService()
  })

  it('onNewAccount', async () => {
    await identityProcessorService.onNewAccount(event)

    expect(IdentityProcessorService.prototype.pushEnrichment).toBeCalledWith('event_id', {
      account_id: 'account_id',
      created_at: 1
    })
  })

  it('onKilledAccount', async () => {
    await identityProcessorService.onKilledAccount(event)

    expect(IdentityProcessorService.prototype.pushEnrichment).toBeCalledWith('event_id', {
      account_id: 'account_id',
      killed_at: 1
    })
  })

  it('onJudgementEvent', async () => {
    await identityProcessorService.onJudgementEvent({ event, status: JudgementStatus.GIVEN })

    expect(IdentityProcessorService.prototype.pushEnrichment).toBeCalledWith('event_id', {
      account_id: 'account_id',
      judgement_status: JudgementStatus.GIVEN,
      registrar_index: parseInt('123', 16)
    })
  })

  it('updateAccountIdentity isEmpty or isNone', async () => {
    identityProcessorService = new IdentityProcessorService()

    await identityProcessorService.updateAccountIdentity({ id: 'id', signer: 'isEmpty' })

    expect(PolkadotModule.prototype.getIdentity).toBeCalled()

    expect(IdentityProcessorService.prototype.pushEnrichment).toBeCalledWith('id', {
      account_id: 'isEmpty',
      display: '',
      legal: '',
      web: '',
      riot: '',
      email: '',
      twitter: ''
    })
  })

  it('updateAccountIdentity is not empty', async () => {
    identityProcessorService = new IdentityProcessorService()

    await identityProcessorService.updateAccountIdentity({ id: 'id', signer: 'signer' })

    expect(PolkadotModule.prototype.getIdentity).toBeCalled()

    expect(IdentityProcessorService.prototype.pushEnrichment).toBeCalledWith('id', {
      account_id: 'signer',
      display: 'display',
      email: 'email',
      legal: 'legal',
      riot: 'riot',
      twitter: 'twitter',
      web: 'web'
    })
  })
})

describe('Push enrichments methods', () => {
  let identityProcessorService: IdentityProcessorService

  beforeEach(() => {
    IdentityProcessorService.prototype.sendToPushEnrichmentSubs = jest.fn()
    identityProcessorService = new IdentityProcessorService()
  })

  it('addSub case', async () => {
    const extrinsic: IExtrinsic = {
      id: 'id',
      method: 'addSub',
      signer: 'signer',
      args: [{ id: 'id' }]
    }

    await identityProcessorService.updateSubAccounts(extrinsic)

    expect(IdentityProcessorService.prototype.sendToPushEnrichmentSubs).toBeCalledWith({
      key: 'id',
      accountId: 'id',
      rootAccountId: 'signer'
    })
  })

  it('setSubs case', async () => {
    const extrinsic: IExtrinsic = {
      id: 'id',
      method: 'setSubs',
      signer: 'signer',
      args: [[['account1'], ['account2']]]
    }

    await identityProcessorService.updateSubAccounts(extrinsic)

    expect(IdentityProcessorService.prototype.sendToPushEnrichmentSubs).toBeCalledTimes(2)

    expect(IdentityProcessorService.prototype.sendToPushEnrichmentSubs).nthCalledWith(1, {
      accountId: 'account1',
      key: 'id_0',
      rootAccountId: 'signer'
    })

    expect(IdentityProcessorService.prototype.sendToPushEnrichmentSubs).nthCalledWith(2, {
      accountId: 'account2',
      key: 'id_1',
      rootAccountId: 'signer'
    })
  })

  it('removeSub case', async () => {
    const extrinsic: IExtrinsic = {
      id: 'id',
      method: 'removeSub',
      signer: 'signer',
      args: ['removedAccountId']
    }

    await identityProcessorService.updateSubAccounts(extrinsic)

    expect(IdentityProcessorService.prototype.sendToPushEnrichmentSubs).toBeCalledWith({
      key: 'id',
      accountId: 'removedAccountId',
      rootAccountId: ''
    })
  })

  it('quitSub case', async () => {
    const extrinsic: IExtrinsic = {
      id: 'id',
      method: 'quitSub',
      signer: 'signer',
      args: ['args']
    }

    await identityProcessorService.updateSubAccounts(extrinsic)

    expect(IdentityProcessorService.prototype.sendToPushEnrichmentSubs).toBeCalledWith({
      key: 'id',
      accountId: 'signer',
      rootAccountId: ''
    })
  })
})

describe('processExtrinsics', () => {
  let identityProcessorService: IdentityProcessorService

  beforeEach(() => {
    IdentityProcessorService.prototype.updateAccountIdentity = jest.fn()
    IdentityProcessorService.prototype.updateSubAccounts = jest.fn()
    identityProcessorService = new IdentityProcessorService()
  })

  it('subs cases', async () => {
    const extrinsics: IExtrinsicsEntry = {
      extrinsics: [
        {
          id: 'id',
          method: 'addSub',
          signer: 'signer',
          args: [{ id: 'id' }]
        },
        {
          id: 'id',
          method: 'quitSub',
          signer: 'signer',
          args: ['args']
        },
        {
          id: 'id',
          method: 'removeSub',
          signer: 'signer',
          args: ['args']
        },
        {
          id: 'id',
          method: 'renameSub',
          signer: 'signer',
          args: ['args']
        },
        {
          id: 'id',
          method: 'setSubs',
          signer: 'signer',
          args: ['args']
        }
      ]
    }
    await identityProcessorService.processExtrinsics(extrinsics)

    expect(IdentityProcessorService.prototype.updateSubAccounts).toBeCalledTimes(5)
  })

  it('identity cases', async () => {
    const extrinsics: IExtrinsicsEntry = {
      extrinsics: [
        {
          id: 'id',
          method: 'clearIdentity',
          signer: 'signer',
          args: [{ id: 'id' }]
        },
        {
          id: 'id',
          method: 'killIdentity',
          signer: 'signer',
          args: ['args']
        },
        {
          id: 'id',
          method: 'setFields',
          signer: 'signer',
          args: ['args']
        },
        {
          id: 'id',
          method: 'setIdentity',
          signer: 'signer',
          args: ['args']
        }
      ]
    }
    await identityProcessorService.processExtrinsics(extrinsics)

    expect(IdentityProcessorService.prototype.updateAccountIdentity).toBeCalledTimes(4)
  })
})

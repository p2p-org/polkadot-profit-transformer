import { ApiPromise, WsProvider } from '@polkadot/api'
import { environment } from '../environment'

const { SUBSTRATE_URI } = environment

export class PolkadotModule {
  private static instance: PolkadotModule

  private wsProvider!: WsProvider
  private api?: ApiPromise

  constructor() {
    if (PolkadotModule.instance) {
      return PolkadotModule.instance
    }

    this.wsProvider = new WsProvider(SUBSTRATE_URI)
    PolkadotModule.instance = this
  }

  static async init(): Promise<void> {
    if (!PolkadotModule.instance) {
      PolkadotModule.instance = new PolkadotModule()
      PolkadotModule.instance.api = await ApiPromise.create({ provider: PolkadotModule.instance.wsProvider })
    }
  }

  static inject(): PolkadotModule {
    if (!PolkadotModule.instance?.api) {
      throw new Error(`You haven't initiated polkadot module`)
    }

    return PolkadotModule.instance
  }

  async getIdentity(accountId: string): Promise<any> {
    const identity = await this.api!.query.identity.identityOf(accountId)
    return identity
  }
}

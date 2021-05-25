import { ApiPromise, WsProvider } from '@polkadot/api/index'
import { environment } from '../environment'

const { SUBSTRATE_URI } = environment

export class PolkadotModule {
  private static instance: PolkadotModule

  private wsProvider: WsProvider
  private api?: ApiPromise
  private constructor() {
    this.wsProvider = new WsProvider(SUBSTRATE_URI)
  }

  static async init(): Promise<void> {
    if (!PolkadotModule.instance) {
      PolkadotModule.instance = new PolkadotModule()
      PolkadotModule.instance.api = await ApiPromise.create({ provider: PolkadotModule.instance.wsProvider })
    }
  }
  static inject(): ApiPromise {
    if (!PolkadotModule.instance.api) {
      throw new Error(`You haven't initiated polkadot module`)
    }

    return PolkadotModule.instance.api
  }
}

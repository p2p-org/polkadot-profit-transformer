import { ApiPromise, WsProvider } from '@polkadot/api'

export const polkadotFactory = async (nodeUrl: string): Promise<ApiPromise> => {
  const provider = new WsProvider(nodeUrl)
  const api = await ApiPromise.create({ provider })

  return api
}

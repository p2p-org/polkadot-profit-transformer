import { ApiPromise, WsProvider } from '@polkadot/api'
import { options } from '@acala-network/api'

export const polkadotFactory = (nodeUrl: string) => async (): Promise<ApiPromise> => {
  const provider = new WsProvider(nodeUrl)
  const api = new ApiPromise(options({ provider }))
  await api.isReady

  return api
}

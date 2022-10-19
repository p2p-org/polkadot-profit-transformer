import { ApiPromise, WsProvider } from '@polkadot/api'

export const polkadotFactory = (nodeUrl: string) => async (): Promise<ApiPromise> => {
  const provider = new WsProvider(
    nodeUrl, 
    2500,
    {},
    300 * 1000,
  )
  const api = await ApiPromise.create({ provider })

  return api
}

import { ApiPromise, WsProvider } from '@polkadot/api'
import { typesBundlePre900 } from 'moonbeam-types-bundle'

export const polkadotFactory = async (nodeUrl: string): Promise<ApiPromise> => {
  const provider = new WsProvider(nodeUrl)
  //@ts-ignore
  const api = await ApiPromise.create({ provider, typesBundlePre900 })

  return api
}

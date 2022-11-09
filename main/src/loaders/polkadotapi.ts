import { environment } from '@/environment'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { typesBundlePre900 } from 'moonbeam-types-bundle'

export const PolkadotApi = (nodeUrl: string) => async (): Promise<ApiPromise> => {
  const provider = new WsProvider(
    nodeUrl,
    2500,
    {},
    300 * 1000,
  )

  let typesBundle = {}
  // extra types for moonbeam/moonriver
  if (environment.NETWORK_ID === 25 || environment.NETWORK_ID === 371) {
    typesBundle = typesBundlePre900
  }

  const api = await ApiPromise.create({
    provider,
    typesBundle
  })

  return api
}

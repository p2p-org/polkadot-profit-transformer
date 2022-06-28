import { ApiPromise, WsProvider } from '@polkadot/api'
import { typesBundlePre900 } from 'moonbeam-types-bundle'
// import '@moonbeam-network/api-augment'
// import '@moonbeam-network/api-augment/moonriver'

export const polkadotFactory = async (nodeUrl: string): Promise<ApiPromise> => {
  const provider = new WsProvider(nodeUrl)
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore
  const api = await ApiPromise.create({ provider, typesBundlePre900 })

  return api
}

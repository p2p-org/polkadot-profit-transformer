import { environment } from '@/environment'
import { ApiPromise, WsProvider } from '@polkadot/api'
import { typesBundlePre900 } from 'moonbeam-types-bundle'
import { logger } from '@/loaders/logger'

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

  Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version()
  ]).then((result) => {
    const [chain, nodeName, nodeVersion] = result;
    logger.info(`✌️ Connected to ${nodeUrl}. Chain ${chain} using ${nodeName} v${nodeVersion}`);
  })

  return api
}

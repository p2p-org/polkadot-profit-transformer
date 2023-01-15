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
  if (environment.NETWORK === 'moonbeam' || environment.NETWORK === 'moonriver') {
    typesBundle = typesBundlePre900
  }

  const api = await ApiPromise.create({
    provider,
    typesBundle
  })

  Promise.all([
    api.rpc.system.chain(),
    api.rpc.system.name(),
    api.rpc.system.version(),
    api.rpc.system.chainType(),
    api.rpc.system.name(),
    api.rpc.system.properties(),
  ]).then((result) => {
    const [chain, nodeName, nodeVersion, chainType, name, properties] = result
    logger.info(`✌️ Connected to ${nodeUrl}. Chain ${chain} using ${nodeName} v${nodeVersion}`)
    //environment.NETWORK_ID = parseInt(properties.toHuman().ss58Format)
    //environment.NETWORK = chain.toLowerCase()
    if (environment.NETWORK != chain.toString()) {
      logger.error(`Wrong network name specified in the environment: '${environment.NETWORK}'. RPC-node network name is '${chain}'.`)
    }
    if (environment.NETWORK_ID != properties.toHuman().ss58Format && environment.NETWORK_ID != properties.toHuman().ss58format) {
      logger.error(`Wrong network id specified in the environment: ${environment.NETWORK_ID}. 
        RPC-node network id is ${properties.toHuman().ss58Format || properties.toHuman().ss58format}.`)
    }
  })

  return api
}

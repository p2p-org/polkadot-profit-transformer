import { environment } from '@/environment'
import { Container, Inject, Service } from 'typedi'
import { ApiPromise, WsProvider, HttpProvider } from '@polkadot/api'
import { typesBundlePre900 } from 'moonbeam-types-bundle'
import { logger } from '@/loaders/logger'
import process from 'node:process'
import { SliMetrics } from '@/loaders/sli_metrics'

export const PolkadotApi = (nodeUrl: string) => async (): Promise<ApiPromise> => {
  const provider = new WsProvider(nodeUrl, 2500, {}, 300 * 1000)

  let typesBundle = {}
  // extra types for moonbeam/moonriver
  if (environment.NETWORK === 'moonbeam' || environment.NETWORK === 'moonriver') {
    typesBundle = typesBundlePre900
  }

  const sliMetrics: SliMetrics = Container.get('sliMetrics')
  const startGatheringRpcMetrics = () => {
    setInterval(async () => {
      const startProcessingTime = Date.now()
      const lastHeader = await api.rpc.chain.getHeader()
      await sliMetrics.add({
        entity: 'rpc',
        entity_id: parseInt(lastHeader.number.toString()),
        name: 'rpc_response_time_ms',
        value: Date.now() - startProcessingTime,
      })
    }, 30 * 1000)
  }

  provider.on('connected', () => {
    logger.info('✌️ PolkadotAPI connected')
    startGatheringRpcMetrics()
  })
  provider.on('disconnected', () => {
    logger.error('PolkadotAPI error: disconnected')
    process.exit(1)
  })
  provider.on('error', (error) => {
    logger.error('PolkadotAPI error: ' + error.message)
    process.exit(2)
  })

  const api = await ApiPromise.create({
    provider,
    typesBundle,
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
    if (environment.NETWORK.toLowerCase() != chain.toString().toLowerCase()) {
      logger.error(
        `Wrong network name specified in the environment: '${environment.NETWORK}'. RPC-node network name is '${chain}'.`,
      )
    }
    const network_id = properties.toHuman().ss58Format || properties.toHuman().ss58format || properties.toHuman().SS58Prefix
    if (environment.NETWORK_ID != network_id) {
      logger.error(`Wrong network id specified in the environment: ${environment.NETWORK_ID}. 
        RPC-node network id is ${network_id}.`)
    }
  })

  return api
}

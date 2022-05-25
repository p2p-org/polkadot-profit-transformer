import { ApiPromise, WsProvider } from '@polkadot/api'

import definitions from '@astar-network/types/dist/networkSpecs/shiden'

export const polkadotFactory = async (nodeUrl: string): Promise<ApiPromise> => {
  const provider = new WsProvider(nodeUrl)

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  //@ts-ignore
  const api = await ApiPromise.create({
    provider,
    types: {
      ...definitions,
    },
  })
  return api
}

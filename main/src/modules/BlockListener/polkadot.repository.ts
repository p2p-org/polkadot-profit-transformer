import { ApiPromise } from '@polkadot/api'
import '@polkadot/api-augment'
import { Header } from '@polkadot/types/interfaces'

export type PolkadotRepository = ReturnType<typeof PolkadotRepository>;

export const PolkadotRepository = (deps: { polkadotApi: ApiPromise }) => {
  const { polkadotApi } = deps
  return {
    async subscribeFinalizedHeads(cb: (header: Header) => Promise<void>) {
      await polkadotApi.rpc.chain.subscribeFinalizedHeads(cb)
    },
    async getFinBlockNumber() {
      const lastFinHeader = await polkadotApi.rpc.chain.getFinalizedHead()
      const lastFinBlock = await polkadotApi.rpc.chain.getBlock(lastFinHeader)

      return lastFinBlock.block.header.number.toNumber()
    },
  }
}

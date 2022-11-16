import { Inject, Service } from 'typedi'
import { ApiPromise } from '@polkadot/api'
import '@polkadot/api-augment'
import { Header } from '@polkadot/types/interfaces'

@Service()
export class BlockListenerPolkadotHelper {
  constructor(
    @Inject('polkadotApi') private readonly polkadotApi: ApiPromise,
  ) { }

  public async subscribeFinalizedHeads(cb: (header: Header) => Promise<void>): Promise<void> {
    await this.polkadotApi.rpc.chain.subscribeFinalizedHeads(cb)
  }

  public async getFinBlockNumber(): Promise<number> {
    const lastFinHeader = await this.polkadotApi.rpc.chain.getFinalizedHead()
    const lastFinBlock = await this.polkadotApi.rpc.chain.getBlock(lastFinHeader)

    return lastFinBlock.block.header.number.toNumber()
  }
}


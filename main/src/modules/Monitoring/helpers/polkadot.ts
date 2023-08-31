import { Inject, Service } from 'typedi'
import { ApiPromise } from '@polkadot/api'
import '@polkadot/api-augment'

@Service()
export class MonitoringPolkadotHelper {
  constructor(@Inject('polkadotApi') private readonly polkadotApi: ApiPromise) {}

  public async getFinBlockNumber(): Promise<number> {
    const lastFinHeader = await this.polkadotApi.rpc.chain.getFinalizedHead()
    const lastFinBlock = await this.polkadotApi.rpc.chain.getBlock(lastFinHeader)

    return lastFinBlock.block.header.number.toNumber()
  }
}

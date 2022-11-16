import { Inject, Service } from 'typedi'
import { ApiPromise } from '@polkadot/api'
import '@polkadot/api-augment'
import { Vec } from '@polkadot/types'
import {
  BlockHash,
  EventRecord,
  Moment,
  SignedBlock,
  Call
} from '@polkadot/types/interfaces'
import { HeaderExtended } from '@polkadot/api-derive/types'
import { BlockMetadata } from '@/models/block.model'
import { environment } from '@/environment'

type callEntry = {
  call: Call
  indexes: number[]
  index: number
}

@Service()
export class BlockProcessorPolkadotHelper {
  constructor(
    @Inject('polkadotApi') private readonly polkadotApi: ApiPromise,
  ) { }

  async getBlockHashByHeight(height: number): Promise<BlockHash> {
    return this.polkadotApi.rpc.chain.getBlockHash(height)
  }

  async getBlockMetadata(
    blockHash: BlockHash,
  ): Promise<BlockMetadata> {
    try {
      const historicalApi = await this.polkadotApi.at(blockHash)

      const metadata: BlockMetadata = {}
      try {
        const runtime: any = await historicalApi.query.system.lastRuntimeUpgrade()
        metadata.runtime = runtime.unwrap().specVersion.toNumber()
      } catch { }

      try {
        const currentEra: any = await historicalApi.query.staking.currentEra()

        if (currentEra) {
          metadata.era_id = parseInt(currentEra.toString(10), 10) as number
        }
      } catch (e) { }

      return metadata

    } catch (error: any) {
      console.log('error on polkadot.repository.getInfoToProcessBlock', error.message)
      throw error
    }
  }
}


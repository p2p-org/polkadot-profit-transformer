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

  async getInfoToProcessBlock(
    blockHash: BlockHash,
  ): Promise<[/* number | null, number | null, number | null, */  SignedBlock, HeaderExtended | undefined, Moment, any, any]> {
    try {
      const historicalApi = await this.polkadotApi.at(blockHash)

      const getMetadata = async (): Promise<BlockMetadata> => {
        const metadata: BlockMetadata = {}
        try {
          const runtime: any = await historicalApi.query.system.lastRuntimeUpgrade()
          metadata.runtime = runtime.unwrap().specVersion.toNumber()
        } catch { }

        try {
          //polkadot, kusama
          if (environment.NETWORK_ID === 1 || environment.NETWORK_ID === 56) {
            const currentEra: any = await historicalApi.query.staking.currentEra()

            if (currentEra) {
              metadata.era_id = parseInt(currentEra.toString(10), 10) as number
            }
          } else {
            //parachains
            //if (specVersion <= 49) return {}

            const round: any = await historicalApi.query.parachainStaking.round()
            metadata.round_id = parseInt(round.current.toString(10), 10) as number
          }
        } catch (e) { }

        return metadata
      }

      const [blockTime, events] = await historicalApi.queryMulti([
        [historicalApi.query.timestamp.now],
        [historicalApi.query.system.events, blockHash],
      ])

      const [metadata, signedBlock, extHeader] = await Promise.all([
        getMetadata(),
        this.polkadotApi.rpc.chain.getBlock(blockHash),
        this.polkadotApi.derive.chain.getHeader(blockHash),
      ])

      return [
        signedBlock as SignedBlock,
        extHeader as HeaderExtended,
        blockTime,
        events,
        metadata,
      ]
    } catch (error: any) {
      console.log('error on polkadot.repository.getInfoToProcessBlock', error.message)
      throw error
    }
  }

  async isExtrinsicEventsSuccess(
    index: number,
    blockEvents: Vec<EventRecord>,
  ): Promise<boolean> {
    const extrinsicIndex = index

    const events = blockEvents.filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(extrinsicIndex))

    const isSuccess = async (events: EventRecord[]): Promise<boolean> => {
      for (const event of events) {
        const success = await this.isExtrinsicEventSuccess(event)

        if (success) return true
      }
      return false
    }

    const success = await isSuccess(events)

    return success
  }

  async isExtrinsicEventSuccess(event: EventRecord): Promise<boolean> {
    const result = await this.polkadotApi.events.system.ExtrinsicSuccess.is(event.event)
    return result
  }


  recursiveExtrinsicDecoder(entry: callEntry): callEntry[] {
    const currentIndexes = [...entry.indexes, entry.index]

    if (entry.call.section === 'utility' && entry.call.method === 'batch') {
      const processedBatchCalls = (<Vec<Call>>entry.call.args[0])
        .map((call, index) => this.recursiveExtrinsicDecoder({ call, indexes: currentIndexes, index }))
        .flat()
      return [entry, ...processedBatchCalls]
    }

    if (entry.call.section === 'multisig' && entry.call.method === 'asMulti') {
      console.log('multisig')
      try {
        const innerCall = entry.call.registry.createType('Call', entry.call.args[3])
        return [entry, ...this.recursiveExtrinsicDecoder({ call: innerCall, indexes: currentIndexes, index: 0 })]
      } catch (error) {
        return [entry]
      }
    }

    if (entry.call.section === 'proxy' && entry.call.method === 'proxy') {
      // console.log('proxy', call.args[2].toHuman())
      const innerCall = entry.call.registry.createType('Call', entry.call.args[2])
      return [entry, ...this.recursiveExtrinsicDecoder({ call: innerCall, indexes: currentIndexes, index: 0 })]
    }

    return [entry]
  }

}


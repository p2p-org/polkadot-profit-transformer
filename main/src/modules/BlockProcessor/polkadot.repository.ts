import { logger } from '@/loaders/logger'
import { ApiPromise } from '@polkadot/api'
import '@polkadot/api-augment'
import {
  BlockHash,
  EraIndex,
  EventIndex,
  EventRecord,
  Exposure,
  Header,
  Moment,
  Registration,
  SessionIndex,
  SignedBlock,
  ValidatorPrefs,
} from '@polkadot/types/interfaces'
import { Option, u32, Vec } from '@polkadot/types'
import { HeaderExtended } from '@polkadot/api-derive/types'
import { IBlockEraParams, TBlockHash } from '@/modules/RelaychainStakingProcessor/staking.types'
import { EraModel } from '@/models/era.model'
import { BlockMetadata } from '@/models/block.model'
import { environment } from '@/environment'

export type PolkadotRepository = ReturnType<typeof PolkadotRepository>;

export const PolkadotRepository = (deps: { polkadotApi: ApiPromise }) => {
  const { polkadotApi } = deps
  return {

    async getBlockHashByHeight(height: number): Promise<BlockHash> {
      return polkadotApi.rpc.chain.getBlockHash(height)
    },

    async getInfoToProcessBlock(
      blockHash: BlockHash,
    ): Promise<[/* number | null, number | null, number | null, */  SignedBlock, HeaderExtended | undefined, Moment, any, any]> {
      try {
        const historicalApi = await polkadotApi.at(blockHash)
        const runtime: any = await historicalApi.query.system.lastRuntimeUpgrade()
        const specVersion = runtime.unwrap().specVersion.toNumber()
        console.log(specVersion);

        const getMetadata = async (): Promise<BlockMetadata> => {
          const metadata: BlockMetadata = {
            runtime: specVersion
          }
          try {
            //polkadot, kusama
            if (environment.NETWORK_ID === 1 || environment.NETWORK_ID === 56) {
              const currentEra: any = await historicalApi.query.staking.currentEra()

              if (currentEra) {
                return {
                  era_id: parseInt(currentEra.toString(10), 10) as number,
                  ...metadata
                }
              } else {
                return metadata
              }
            } else {
              //parachains
              //if (specVersion <= 49) return {}

              const round: any = await historicalApi.query.parachainStaking.round()
              return {
                round_id: parseInt(round.current.toString(10), 10) as number,
                ...metadata
              }
            }
          } catch (e) {
            return metadata
          }
        }

        const [blockTime, events] = await historicalApi.queryMulti([
          [historicalApi.query.timestamp.now],
          [historicalApi.query.system.events, blockHash],
        ])

        const [metadata, signedBlock, extHeader] = await Promise.all([
          getMetadata(),
          polkadotApi.rpc.chain.getBlock(blockHash),
          polkadotApi.derive.chain.getHeader(blockHash),
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
    },

    async isExtrinsicSuccess(event: EventRecord) {
      const result = await polkadotApi.events.system.ExtrinsicSuccess.is(event.event)
      return result
    },


  }
};

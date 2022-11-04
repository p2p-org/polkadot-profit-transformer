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

    async getRewardPoints(blockHash: TBlockHash, eraId: number): Promise<Map<string, number>> {
      const { individual } = await polkadotApi.query.staking.erasRewardPoints.at(blockHash, eraId)
      const eraRewardPointsMap: Map<string, number> = new Map()

      individual.forEach((rewardPoints, accountId) => {
        eraRewardPointsMap.set(accountId.toString(), rewardPoints.toNumber())
      })

      return eraRewardPointsMap
    },

    async getDistinctValidatorsAccountsByEra(blockId: number): Promise<Set<string>> {
      const blockHash = await this.getBlockHashByHeight(blockId)
      const distinctValidators: Set<string> = new Set()
      const validators = await polkadotApi.query.session.validators.at(blockHash)

      validators.forEach((accountId) => {
        distinctValidators.add(accountId.toString())
      })

      return distinctValidators
    },

    async getStakersInfo(
      blockHash: TBlockHash,
      eraId: number,
      validatorAccountId: string,
    ): Promise<[Exposure, Exposure, ValidatorPrefs]> {
      const [staking, stakingClipped, prefs] = await Promise.all([
        polkadotApi.query.staking.erasStakers.at(blockHash, eraId, validatorAccountId),
        polkadotApi.query.staking.erasStakersClipped.at(blockHash, eraId, validatorAccountId),
        polkadotApi.query.staking.erasValidatorPrefs.at(blockHash, eraId, validatorAccountId),
      ])

      return [staking, stakingClipped, prefs]
    },

    async getStakingPayee(
      blockHash: TBlockHash,
      accountId: string,
    ): Promise<{
      reward_dest?: string
      reward_account_id?: string
    }> {
      const payee = await polkadotApi.query.staking.payee.at(blockHash, accountId)
      let reward_dest; let
        reward_account_id
      if (payee) {
        if (payee) {
          if (!payee.isAccount) {
            reward_dest = payee.toString()
          } else {
            reward_dest = 'Account'
            reward_account_id = payee.asAccount.toString()
          }
        }
      }
      return {
        reward_dest,
        reward_account_id,
      }
    },

    async getEraData({ eraId, blockHash }: IBlockEraParams): Promise<Omit<EraModel, 'payout_block_id'>> {
      logger.debug({ getEraData: { eraId, blockHash } })
      const [totalReward, erasRewardPoints, totalStake, sessionStart] = await Promise.all([
        polkadotApi.query.staking.erasValidatorReward.at(blockHash, eraId),
        polkadotApi.query.staking.erasRewardPoints.at(blockHash, eraId),
        polkadotApi.query.staking.erasTotalStake.at(blockHash, eraId),
        polkadotApi.query.staking.erasStartSessionIndex.at(blockHash, eraId),
      ])

      logger.debug({ sessionStart: sessionStart.toHuman() })

      console.log('TOTAL REWARD', totalReward.toHuman())

      return {
        era: eraId,
        total_reward: totalReward.toString(),
        total_stake: totalStake.isEmpty ? '0' : totalStake.toString(),
        total_reward_points: +erasRewardPoints.total.toString(),
        session_start: sessionStart.unwrap().toNumber(),
      }
    },

    async getBlockHashByHeight(height: number): Promise<BlockHash> {
      return polkadotApi.rpc.chain.getBlockHash(height)
    },

    async getBlockTime(blockHash: TBlockHash): Promise<number> {
      const blockTime = await polkadotApi.query.timestamp.now.at(blockHash)
      return blockTime.toNumber()
    },


    /*
    
    
        createType<T>(type: string, data: any): T {
          // todo fix generic
          return polkadotApi.createType(type, data) as unknown as T
        },
        async getChainInfo(): Promise<string> {
          const currentChain = await polkadotApi.rpc.system.chain()
          return currentChain.toString()
        },
        async getFinBlockNumber() {
          const lastFinHeader = await polkadotApi.rpc.chain.getFinalizedHead()
          const lastFinBlock = await polkadotApi.rpc.chain.getBlock(lastFinHeader)
    
          return lastFinBlock.block.header.number.toNumber()
        },
        
        async isExtrinsicSuccess(event: EventRecord) {
          const result = await polkadotApi.events.system.ExtrinsicSuccess.is(event.event)
          return result
        },
    
        
    
    
        async getCurrentRawEra(blockHash?: TBlockHash): Promise<Option<EraIndex>> {
          if (blockHash) {
            return polkadotApi.query.staking.currentEra.at(blockHash)
          }
          return polkadotApi.query.staking.currentEra()
        },
    
        
    
        
    
        async getStakingPrefs(blockHash: TBlockHash, eraId: number, validatorAccountId: string): Promise<ValidatorPrefs> {
          return polkadotApi.query.staking.erasValidatorPrefs.at(blockHash, eraId, validatorAccountId)
        },
    
    
        async subscribeFinalizedHeads(cb: (header: Header) => Promise<void>) {
          await polkadotApi.rpc.chain.subscribeFinalizedHeads(cb)
        },
    
        async getSystemEvents(hash: TBlockHash): Promise<Vec<EventRecord>> {
          return polkadotApi.query.system.events.at(hash)
        },
    
        async getBlockData(hash: TBlockHash): Promise<SignedBlock> {
          return polkadotApi.rpc.chain.getBlock(hash)
        },
    
        async getSystemEventsCount(hash: TBlockHash): Promise<EventIndex> {
          return polkadotApi.query.system.eventCount.at(hash)
        },
    
        async getInfoToProcessBlock(
          blockHash: BlockHash,
        ): Promise<[ SignedBlock, HeaderExtended | undefined, Moment, any, any]> {
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
    
        async getHistoryDepth(blockHash: TBlockHash): Promise<u32> {
          return polkadotApi.query.staking.historyDepth.at(blockHash)
        },
    
    
    
        async getIdentity(accountId: string): Promise<Registration | undefined> {
          const identity = await polkadotApi.query.identity.identityOf(accountId)
          if (identity.isEmpty || identity.isNone) return undefined
    
          return identity.unwrap()
        },
        */
  }
};

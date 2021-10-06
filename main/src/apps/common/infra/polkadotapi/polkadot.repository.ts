import { Logger } from './../logger/logger'
import { ApiPromise } from '@polkadot/api'
import {
  ActiveEraInfo,
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
import { IBlockEraParams, TBlockHash } from '@modules/staking-processor/staking.types'
import { EraModel } from '../postgresql/models/era.model'

export type PolkadotRepository = ReturnType<typeof PolkadotRepository>

export const PolkadotRepository = (deps: { polkadotApi: ApiPromise; logger: Logger }) => {
  const { polkadotApi, logger } = deps
  return {
    createType<T>(type: string, data: any): T {
      //todo fix generic
      return polkadotApi.createType(type, data) as unknown as T
    },
    async getChainInfo(): Promise<[string, string]> {
      const [currentChain, currentChainType] = (
        await Promise.all([
          polkadotApi.rpc.system.chain(), // Polkadot
          polkadotApi.rpc.system.chainType(), // Live
        ])
      ).map((value) => value.toString().trim())

      return [currentChain, currentChainType]
    },
    async getFinBlockNumber() {
      const lastFinHeader = await polkadotApi.rpc.chain.getFinalizedHead()
      const lastFinBlock = await polkadotApi.rpc.chain.getBlock(lastFinHeader)

      return lastFinBlock.block.header.number.toNumber()
    },
    async getBlockHashByHeight(height: number): Promise<BlockHash> {
      return polkadotApi.rpc.chain.getBlockHash(height)
    },
    async isExtrinsicSuccess(event: EventRecord) {
      const result = await polkadotApi.events.system.ExtrinsicSuccess.is(event.event)
      return result
    },
    async getEraData({ eraId, blockHash }: IBlockEraParams): Promise<EraModel> {
      const [totalReward, erasRewardPoints, totalStake, sessionStart] = await Promise.all([
        polkadotApi.query.staking.erasValidatorReward.at(blockHash, eraId),
        polkadotApi.query.staking.erasRewardPoints.at(blockHash, eraId),
        polkadotApi.query.staking.erasTotalStake.at(blockHash, eraId),
        polkadotApi.query.staking.erasStartSessionIndex.at(blockHash, eraId),
      ])

      return {
        era: eraId,
        total_reward: totalReward.toString(),
        total_stake: totalStake.toString(),
        total_reward_points: +erasRewardPoints.total.toString(),
        session_start: sessionStart.unwrap().toNumber(),
      }
    },
    async getBlockTime(blockHash: TBlockHash): Promise<number> {
      const blockTime = await polkadotApi.query.timestamp.now.at(blockHash)
      return blockTime.toNumber()
    },

    async getDistinctValidatorsAccountsByEra(blockHash: string): Promise<Set<string>> {
      const distinctValidators: Set<string> = new Set()
      const validators = await polkadotApi.query.session.validators.at(blockHash)

      validators.forEach((accountId) => {
        distinctValidators.add(accountId.toString())
      })

      return distinctValidators
    },

    async getRewardPoints(blockHash: TBlockHash, eraId: number): Promise<Map<string, number>> {
      const { individual } = await polkadotApi.query.staking.erasRewardPoints.at(blockHash, eraId)
      const eraRewardPointsMap: Map<string, number> = new Map()

      individual.forEach((rewardPoints, accountId) => {
        eraRewardPointsMap.set(accountId.toString(), rewardPoints.toNumber())
      })

      return eraRewardPointsMap
    },

    async getStakersInfo(blockHash: TBlockHash, eraId: number, validatorAccountId: string): Promise<[Exposure, Exposure, ValidatorPrefs]> {
      const [staking, stakingClipped, prefs] = await Promise.all([
        polkadotApi.query.staking.erasStakers.at(blockHash, eraId, validatorAccountId),
        polkadotApi.query.staking.erasStakersClipped.at(blockHash, eraId, validatorAccountId),
        polkadotApi.query.staking.erasValidatorPrefs.at(blockHash, eraId, validatorAccountId),
      ])

      return [staking, stakingClipped, prefs]
    },

    async getStakingPrefs(blockHash: TBlockHash, eraId: number, validatorAccountId: string): Promise<ValidatorPrefs> {
      return polkadotApi.query.staking.erasValidatorPrefs.at(blockHash, eraId, validatorAccountId)
    },

    async getStakingPayee(
      blockHash: TBlockHash,
      accountId: string,
    ): Promise<{
      reward_dest?: string
      reward_account_id?: string
    }> {
      const payee = await polkadotApi.query.staking.payee.at(blockHash, accountId)
      let reward_dest, reward_account_id
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
    ): Promise<[SessionIndex, Option<EraIndex>, Option<ActiveEraInfo>, SignedBlock, HeaderExtended | undefined, Moment, Vec<EventRecord>]> {
      const [sessionId, blockCurrentEra, activeEra, signedBlock, extHeader, blockTime, events] = await Promise.all([
        polkadotApi.query.session.currentIndex.at(blockHash),
        polkadotApi.query.staking.currentEra.at(blockHash),
        polkadotApi.query.staking.activeEra.at(blockHash),
        polkadotApi.rpc.chain.getBlock(blockHash),
        polkadotApi.derive.chain.getHeader(blockHash),
        polkadotApi.query.timestamp.now.at(blockHash),
        polkadotApi.query.system.events.at(blockHash),
      ])

      return [sessionId, blockCurrentEra, activeEra, signedBlock, extHeader, blockTime, events]
    },

    async getHistoryDepth(blockHash: TBlockHash): Promise<u32> {
      return polkadotApi.query.staking.historyDepth.at(blockHash)
    },

    async getCurrentRawEra(blockHash?: TBlockHash): Promise<Option<EraIndex>> {
      if (blockHash) {
        return polkadotApi.query.staking.currentEra.at(blockHash)
      }
      return polkadotApi.query.staking.currentEra()
    },

    async getInfoToCheckHistoryDepth(blockHash: TBlockHash): Promise<[SessionIndex, Option<ActiveEraInfo>, HeaderExtended | undefined]> {
      const [sessionId, activeEra, extHeader] = await Promise.all([
        polkadotApi.query.session.currentIndex.at(blockHash),
        polkadotApi.query.staking.activeEra.at(blockHash),
        polkadotApi.derive.chain.getHeader(blockHash),
      ])

      return [sessionId, activeEra, extHeader]
    },

    async getIdentity(accountId: string): Promise<Registration> {
      const identity = (await polkadotApi.query.identity.identityOf(accountId)).unwrap()
      return identity
    },
  }
}
import { ApiPromise, WsProvider } from '@polkadot/api'
import { environment } from '../environment'
import { IBlockEraParams, IEraData, TBlockHash } from '../services/staking/staking.types'
import {
  ActiveEraInfo,
  BlockHash,
  EraIndex,
  EventIndex,
  EventRecord,
  Exposure,
  Header,
  Moment,
  SessionIndex,
  SignedBlock,
  ValidatorPrefs
} from '@polkadot/types/interfaces'
import { Option, u32, Vec } from '@polkadot/types'
import { HeaderExtended } from '@polkadot/api-derive/types'

const { SUBSTRATE_URI } = environment

export class PolkadotModule {
  private static instance: PolkadotModule

  private wsProvider!: WsProvider
  private api?: ApiPromise

  constructor() {
    if (PolkadotModule.instance) {
      return PolkadotModule.instance
    }

    this.wsProvider = new WsProvider(SUBSTRATE_URI)
    PolkadotModule.instance = this
  }

  static async init(): Promise<void> {
    if (!PolkadotModule.instance) {
      PolkadotModule.instance = new PolkadotModule()
      PolkadotModule.instance.api = await ApiPromise.create({ provider: PolkadotModule.instance.wsProvider })
    }
  }
  static inject(): PolkadotModule {
    if (!PolkadotModule.instance?.api) {
      throw new Error(`You haven't initiated polkadot module`)
    }

    return PolkadotModule.instance
  }

  async getChainInfo(): Promise<[string, string]> {
    const [currentChain, currentChainType] = (
      await Promise.all([
        this.api!.rpc.system.chain(), // Polkadot
        this.api!.rpc.system.chainType() // Live
      ])
    ).map((value) => value.toString().trim())

    return [currentChain, currentChainType]
  }

  async getEraData({ eraId, blockHash }: IBlockEraParams): Promise<IEraData> {
    const [totalReward, erasRewardPoints, totalStake, sessionStart] = await Promise.all([
      this.api!.query.staking.erasValidatorReward.at(blockHash, eraId),
      this.api!.query.staking.erasRewardPoints.at(blockHash, eraId),
      this.api!.query.staking.erasTotalStake.at(blockHash, eraId),
      this.api!.query.staking.erasStartSessionIndex.at(blockHash, eraId)
    ])

    return {
      era: eraId,
      total_reward: totalReward.toString(),
      total_stake: totalStake.toString(),
      total_reward_points: +erasRewardPoints.total.toString(),
      session_start: sessionStart.unwrap().toNumber()
    }
  }

  async getBlockTime(blockHash: TBlockHash): Promise<number> {
    const blockTime = await this.api!.query.timestamp.now.at(blockHash)
    return blockTime.toNumber()
  }

  async getDistinctValidatorsAccountsByEra(blockHash: string): Promise<Set<string>> {
    const distinctValidators: Set<string> = new Set()
    const validators = await this.api!.query.session.validators.at(blockHash)

    validators.forEach((accountId) => {
      distinctValidators.add(accountId.toString())
    })

    return distinctValidators
  }

  async getRewardPoints(blockHash: TBlockHash, eraId: number): Promise<Map<string, number>> {
    const { individual } = await this.api!.query.staking.erasRewardPoints.at(blockHash, eraId)
    const eraRewardPointsMap: Map<string, number> = new Map()

    individual.forEach((rewardPoints, accountId) => {
      eraRewardPointsMap.set(accountId.toString(), rewardPoints.toNumber())
    })

    return eraRewardPointsMap
  }

  async getStakersInfo(blockHash: TBlockHash, eraId: number, validatorAccountId: string): Promise<[Exposure, Exposure, ValidatorPrefs]> {
    const [staking, stakingClipped, prefs] = await Promise.all([
      this.api!.query.staking.erasStakers.at(blockHash, eraId, validatorAccountId),
      this.api!.query.staking.erasStakersClipped.at(blockHash, eraId, validatorAccountId),
      this.api!.query.staking.erasValidatorPrefs.at(blockHash, eraId, validatorAccountId)
    ])

    return [staking, stakingClipped, prefs]
  }

  async getStakingPrefs(blockHash: TBlockHash, eraId: number, validatorAccountId: string): Promise<ValidatorPrefs> {
    return this.api!.query.staking.erasValidatorPrefs.at(blockHash, eraId, validatorAccountId)
  }

  async getStakingPayee(
    blockHash: TBlockHash,
    accountId: string
  ): Promise<{
    reward_dest?: string
    reward_account_id?: string
  }> {
    const payee = await this.api!.query.staking.payee.at(blockHash, accountId)
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
      reward_account_id
    }
  }

  async subscribeFinalizedHeads(cb: (header: Header) => Promise<void>) {
    await this.api!.rpc.chain.subscribeFinalizedHeads(cb)
  }

  async getSystemEvents(hash: TBlockHash): Promise<Vec<EventRecord>> {
    return this.api!.query.system.events.at(hash)
  }

  async getBlockData(hash: TBlockHash): Promise<SignedBlock> {
    return this.api!.rpc.chain.getBlock(hash)
  }

  async getSystemEventsCount(hash: TBlockHash): Promise<EventIndex> {
    return this.api!.query.system.eventCount.at(hash)
  }

  async getBlockHashByHeight(height: number): Promise<BlockHash> {
    return this.api!.rpc.chain.getBlockHash(height)
  }

  async getInfoToProcessBlock(
    blockHash: TBlockHash
    //todo fix active era type
  ): Promise<[SessionIndex, Option<EraIndex>, any, SignedBlock, HeaderExtended | undefined, Moment, Vec<EventRecord>]> {
    const historicalApi = await this.api?.at(blockHash)

    const [sessionId, blockCurrentEra, signedBlock, extHeader, blockTime, events] = await Promise.all([
      historicalApi!.query.session.currentIndex(),
      historicalApi!.query.staking.currentEra(),
      this.api!.rpc.chain.getBlock(blockHash),
      this.api!.derive.chain.getHeader(blockHash),
      historicalApi!.query.timestamp.now(),
      historicalApi!.query.system.events()
    ])

    let activeEra = { isNone: true }

    if (!!historicalApi!.query.staking.activeEra) activeEra = await historicalApi!.query.staking.activeEra()

    return [sessionId, blockCurrentEra, activeEra, signedBlock, extHeader, blockTime, events]
  }

  async getHistoryDepth(blockHash: TBlockHash): Promise<u32> {
    return this.api!.query.staking.historyDepth.at(blockHash)
  }

  async getCurrentRawEra(blockHash?: TBlockHash): Promise<Option<EraIndex>> {
    if (blockHash) {
      return this.api!.query.staking.currentEra.at(blockHash)
    }
    return this.api!.query.staking.currentEra()
  }

  async getFinBlockNumber(): Promise<number> {
    const lastFinHeader = await this.api!.rpc.chain.getFinalizedHead()
    const lastFinBlock = await this.api!.rpc.chain.getBlock(lastFinHeader)

    return lastFinBlock.block.header.number.toNumber()
  }

  async getHeader(): Promise<Header> {
    return this.api!.rpc.chain.getHeader()
  }
}

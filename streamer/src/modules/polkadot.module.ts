import { ApiPromise, WsProvider } from '@polkadot/api'
import { environment } from '../environment'
import { IBlockEraParams, IEraData, TBlockHash } from '../services/staking/staking.types'
import {
  ActiveEraInfo,
  BlockHash,
  EraIndex,
  EraRewardPoints,
  EventIndex,
  EventRecord,
  Exposure,
  Header,
  Moment,
  RewardDestination,
  SessionIndex,
  SignedBlock,
  ValidatorId,
  ValidatorPrefs
} from '@polkadot/types/interfaces'
import { Option, u32, Vec } from '@polkadot/types'
import { HeaderExtended } from '@polkadot/api-derive/types'

const { SUBSTRATE_URI } = environment

export interface IPolkadotModule {}

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

  async getBlockTime(blockHash: TBlockHash): Promise<Moment> {
    return this.api!.query.timestamp.now.at(blockHash)
  }

  async getValidatorsStartedEra(blockHash: string): Promise<Vec<ValidatorId>> {
    return this.api!.query.session.validators.at(blockHash)
  }

  async getRewardPoints(blockHash: TBlockHash, eraId: number): Promise<EraRewardPoints> {
    return this.api!.query.staking.erasRewardPoints.at(blockHash, eraId)
  }

  async getStakersInfo(blockHash: TBlockHash, eraId: number, validatorAccountId: string): Promise<[Exposure, Exposure]> {
    const [stakers, stakersClipped] = await Promise.all([
      this.api!.query.staking.erasStakers.at(blockHash, eraId, validatorAccountId),
      this.api!.query.staking.erasStakersClipped.at(blockHash, eraId, validatorAccountId)
    ])

    return [stakers, stakersClipped]
  }

  async getStakingPrefs(blockHash: TBlockHash, eraId: number, validatorAccountId: string): Promise<ValidatorPrefs> {
    return this.api!.query.staking.erasValidatorPrefs.at(blockHash, eraId, validatorAccountId)
  }

  async getStakingPayee(blockHash: TBlockHash, validatorAccountId: string): Promise<RewardDestination> {
    return this.api!.query.staking.payee.at(blockHash, validatorAccountId)
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
  ): Promise<[SessionIndex, Option<EraIndex>, Option<ActiveEraInfo>, SignedBlock, HeaderExtended | undefined, Moment, Vec<EventRecord>]> {
    const [sessionId, blockCurrentEra, activeEra, signedBlock, extHeader, blockTime, events] = await Promise.all([
      this.api!.query.session.currentIndex.at(blockHash),
      this.api!.query.staking.currentEra.at(blockHash),
      this.api!.query.staking.activeEra.at(blockHash),
      this.api!.rpc.chain.getBlock(blockHash),
      this.api!.derive.chain.getHeader(blockHash),
      this.api!.query.timestamp.now.at(blockHash),
      this.api!.query.system.events.at(blockHash)
    ])

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

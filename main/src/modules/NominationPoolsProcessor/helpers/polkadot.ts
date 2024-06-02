import { Inject, Service } from 'typedi'
import { Logger } from 'pino'
import { ApiPromise } from '@polkadot/api'
import '@polkadot/api-augment'
import { BlockHash, Exposure, ValidatorPrefs, RewardDestination } from '@polkadot/types/interfaces'
import { StakeEraModel } from '@/models/stake_era.model'
import { RewardEraModel } from '@/models/reward_era.model'
import { IBlockEraParams, PoolData, PoolMembers, Pools } from '../interfaces'
import { NominatorModel } from '@/models/nominator.model'
import { ValidatorModel } from '@/models/validator.model'
import { IndividualExposure } from '@polkadot/types/interfaces'
import { Vec } from '@polkadot/types'
import Queue from 'better-queue'
import { u8aConcat, stringToU8a, bnToU8a, BN } from '@polkadot/util'

@Service()
export class NominationPoolsProcessorPolkadotHelper {
  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('polkadotApi') private readonly polkadotApi: ApiPromise,
  ) {}

  async getNominationPools({ eraId, blockHash }: IBlockEraParams): Promise<Pools> {
    this.logger.info({ event: `Get pools data for era: ${eraId}`, eraId })
    const apiAtBlock: any = await this.polkadotApi.at(blockHash)

    const members = await this.getPoolMembers(apiAtBlock)
    let pools: Pools = {}
    const poolsEntries = await apiAtBlock.query.nominationPools.bondedPools.entries()
    for (let key in poolsEntries) {
      const poolId = poolsEntries[key][0].toHuman()[0]
      pools[poolId] = await this.getPoolData(apiAtBlock, poolId, members, poolsEntries[key][1].toJSON())
    }
    this.logger.info({ event: `Count of collected pools: ${Object.keys(pools).length}` })
    return pools
  }

  async getPoolData(api: ApiPromise, poolId: number, members: any, bondedPool: any): Promise<PoolData | undefined> {
    this.logger.info({ event: `Get pool with id: ${poolId}`, poolId })
    //depositor: '12NRTphLWqYK5Tri7V2aVGcXWuJ78NFPPjwSN9ZkUxLhCa78',
    //root: '12NRTphLWqYK5Tri7V2aVGcXWuJ78NFPPjwSN9ZkUxLhCa78',
    //nominator: '12NRTphLWqYK5Tri7V2aVGcXWuJ78NFPPjwSN9ZkUxLhCa78',
    //bouncer: '12NRTphLWqYK5Tri7V2aVGcXWuJ78NFPPjwSN9ZkUxLhCa78'
    //13UVJyLnbVp8c4FQeiGUYwmthuauL7RecwzpKCd3cwgRPCPp

    try {
      var pool: any = { id: poolId, ...bondedPool }

      pool.name = await this.getPoolName(api, poolId)

      pool.rewardPools = await api.query.nominationPools.rewardPools(poolId)
      pool.rewardPools = pool.rewardPools.toJSON()

      const membersBond = await api.query.nominationPools.poolMembers(pool.roles.root)
      if (membersBond) {
        pool.membersBond = membersBond.toJSON()
      }
      pool.members = members[poolId]

      pool.subPoolStorage = await api.query.nominationPools.subPoolsStorage(poolId)
      pool.subPoolStorage = pool.subPoolStorage.toJSON()

      if (pool?.points && typeof pool?.points === 'string' && pool?.points?.match(/^0x/i)) {
        pool.points = BigInt(pool.points)
      }

      pool.roles.rewardAccount = this.getPoolRewardsAccount(api, poolId)
      return pool
    } catch (e) {
      console.error(e)
    }
    return
  }

  async getPoolMembers(api: ApiPromise): Promise<PoolMembers> {
    this.logger.info({ event: `Get pool memebers` })
    var entries = await api.query.nominationPools.poolMembers.entries()
    this.logger.info({ event: `Process pool memebers` })
    var members = entries.reduce(
      (
        all: any,
        [
          {
            args: [accountId],
          },
          optMember,
        ],
      ) => {
        if (optMember.isSome) {
          const member = optMember.unwrap()
          const poolId = member.poolId.toString()
          this.logger.info({ event: `Process pool members with id: ${poolId}`, poolId })

          if (!all[poolId]) {
            all[poolId] = []
          }

          const data: any = member.toJSON()
          if (data?.points && typeof data?.points === 'string' && data?.points?.match(/^0x/i)) {
            data.points = BigInt(data.points)
          }
          data.lastRecordedRewardCounter = data.lastRecordedRewardCounter

          all[poolId].push({ account: accountId.toString(), data })
        }

        return all
      },
      {},
    )
    this.logger.info({ event: `Pool memebers count: ${Object.keys(members).length}` })
    return members
  }

  getPoolRewardsAccount(api: ApiPromise, pool_id: number) {
    const pallet_id = api.consts.nominationPools.palletId.toU8a()

    return api.registry
      .createType(
        'AccountId32',
        u8aConcat(
          stringToU8a('modl'),
          pallet_id,
          new Uint8Array([1]),
          bnToU8a(new BN(pool_id), { bitLength: 32, isLe: true }),
          new Uint8Array(32),
        ),
      )
      .toString()
  }

  async getPoolName(api: ApiPromise, pool_id: number) {
    const name = await api.query.nominationPools.metadata(pool_id)
    return this.hexToString(name.toString())
  }

  hexToString(str1: string) {
    const hex = str1.toString()
    let str = ''
    for (var n = 0; n < hex.length; n += 2) {
      str += String.fromCharCode(parseInt(hex.substr(n, 2), 16))
    }
    return str
  }

  hexToInt(hex: string): number {
    if (hex.startsWith('0x')) {
      hex = hex.slice(2)
    }

    return parseBigInt(hex, 16)
  }

  async getBlockHashByHeight(height: number): Promise<BlockHash> {
    return this.polkadotApi.rpc.chain.getBlockHash(height)
  }

  /*
  async getPoolBalance(api: ApiPromise, pool_id: number) {
    const pool_account = this.getPoolRewardsAccount(api, pool_id)
    console.log(pool_account)
    //console.log("222", JSON.stringify(await api.query.staking.ledger(pool_account)));
    //const pool_active_balance = (await api.query.staking.ledger(pool_account)).toJSON().active
    //const staked_enj_supply = (await api.query.multiTokens.tokens(1, pool_id)).toJSON().supply
    //const pool_stake_factor = pool_active_balance / staked_enj_supply

    const balance = (await api.query.multiTokens.tokenAccounts(1, pool_id, account))
      .toJSON().balance
    console.log("BALANCE", balance)

    return balance;
  }
  */
}

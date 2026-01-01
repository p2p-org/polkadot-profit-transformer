import { environment } from '@/environment'
import { Inject, Service } from 'typedi'
import { Logger } from 'pino'
import { ApiPromise } from '@polkadot/api'
import '@polkadot/api-augment'
import { BlockHash, Exposure, ValidatorPrefs, RewardDestination } from '@polkadot/types/interfaces'
import { StakeEraModel } from '@/models/stake_era.model'
import { RewardEraModel } from '@/models/reward_era.model'
import { IBlockEraParams, IGetValidatorsNominatorsResult, TBlockHash } from '../interfaces'
import { NominatorModel } from '@/models/nominator.model'
import { ValidatorModel } from '@/models/validator.model'
import { IndividualExposure } from '@polkadot/types/interfaces'
import { Vec } from '@polkadot/types'
import Queue from 'better-queue'

@Service()
export class PolkadotStakingProcessorPolkadotHelper {
  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('polkadotApi') private readonly polkadotApi: ApiPromise,
  ) {}

  async getValidatorsAndNominatorsStake(args: {
    eraId: number
    eraStartBlockId: number
  }): Promise<IGetValidatorsNominatorsResult> {
    return new Promise(async (res, rej) => {
      const { eraId, eraStartBlockId } = args

      const nominators: NominatorModel[] = []
      const validators: ValidatorModel[] = []

      const validatorsAccountIdSet: Set<string> = await this.getDistinctValidatorsAccountsByEra(eraStartBlockId)

      const eraStartBlockHash = await this.getBlockHashByHeight(eraStartBlockId)
      const eraStartBlockTime = await this.getBlockTime(eraStartBlockHash)

      const processValidator = async (validatorAccountId: string, cb: any): Promise<void> => {
        this.logger.info(`Era: ${eraId}. Process stake for validator ${validatorAccountId} `)
        const [{ total, own, others }, { others: othersClipped }, prefs] = await this.getStakersInfo(
          eraStartBlockHash,
          eraId,
          validatorAccountId,
        )

        this.logger.info(`validator ${validatorAccountId} has ${others.length} nominators`)

        for (let i = 0; i < others.length; i++) {
          const { who, value } = others[i]
          nominators.push({
            account_id: who.toString(),
            value: value.toString(),
            is_clipped:
              othersClipped === null ||
              !!othersClipped.find((e: { who: { toString: () => any } }) => {
                return e.who.toString() === who.toString()
              }),
            era_id: eraId,
            validator: validatorAccountId,
            //block_time: new Date(eraStartBlockTime),
          })
        }

        validators.push({
          era_id: eraId,
          account_id: validatorAccountId,
          total: total.toString(),
          own: own.toString(),
          nominators_count: others.length,
          prefs: prefs.toJSON(),
          //block_time: new Date(eraStartBlockTime),
        })

        cb()
      }

      const queue = new Queue(processValidator, { concurrent: 5 })

      for (const validator of Array.from(validatorsAccountIdSet)) {
        queue.push(validator)
      }

      queue.on('drain', function () {
        res({
          validators,
          nominators,
        })
      })

      queue.on('task_failed', function (taskId: any, err: any, stats: any) {
        rej()
      })
    })
  }

  async getValidatorsAndNominatorsPayout(args: {
    eraId: number
    eraStartBlockId: number
    payoutBlockHash: TBlockHash
    payoutBlockTime: number
  }): Promise<IGetValidatorsNominatorsResult> {
    return new Promise(async (res, rej) => {
      const { eraId, payoutBlockHash, payoutBlockTime, eraStartBlockId } = args
      const eraRewardPointsMap: Map<string, number> = await this.getRewardPoints(payoutBlockHash, +eraId)

      const nominatorsResult: NominatorModel[] = []
      const validatorsResult: ValidatorModel[] = []

      const { validators, nominators } = await this.getValidatorsAndNominatorsStake({
        eraId,
        eraStartBlockId,
      })

      const processValidator = async (validator: ValidatorModel, cb: any): Promise<void> => {
        this.logger.info(`Era: ${eraId}. Process rewards for validator ${validator.account_id} `)

        const others = nominators.filter((nominator) => nominator.validator === validator.account_id)

        const sliceNominatorsToChunks = (arr: NominatorModel[], chunkSize: number): Array<NominatorModel[]> => {
          const res = []
          for (let i = 0; i < arr.length; i += chunkSize) {
            const chunk = arr.slice(i, i + chunkSize)
            res.push(chunk)
          }
          return res
        }

        const nominatorsChunked = sliceNominatorsToChunks(
          others,
          process.env.NOMINATORS_CUNCURRENCY ? Number(process.env.NOMINATORS_CUNCURRENCY) : 50,
        )

        this.logger.info(`validator ${validator.account_id} has ${others.length} nominators`)

        for (const chunk of nominatorsChunked) {
          const chunkResult = await Promise.all(
            chunk.map(async (nominator) => {
              return {
                ...nominator,
                ...(await this.getStakingPayee(payoutBlockHash, nominator.account_id)),
              }
            }),
          )

          nominatorsResult.push(...chunkResult)
        }

        validatorsResult.push({
          ...validator,
          reward_points: eraRewardPointsMap.get(validator.account_id) || 0,
          ...(await this.getStakingPayee(payoutBlockHash, validator.account_id)),
        })

        cb()
      }

      const queue = new Queue(processValidator, { concurrent: 5 })

      validators.forEach((validator) => {
        queue.push(validator)
      })

      queue.on('drain', function () {
        res({
          validators: validatorsResult,
          nominators: nominatorsResult,
        })
      })

      queue.on('task_failed', function (taskId: any, err: any, stats: any) {
        rej()
      })
    })
  }

  async getRewardPoints(blockHash: TBlockHash, eraId: number): Promise<Map<string, number>> {
    const { individual } = await this.polkadotApi.query.staking.erasRewardPoints.at(blockHash, eraId)
    const eraRewardPointsMap: Map<string, number> = new Map()

    individual.forEach((rewardPoints, accountId) => {
      eraRewardPointsMap.set(accountId.toString(), rewardPoints.toNumber())
    })

    return eraRewardPointsMap
  }

  async getDistinctValidatorsAccountsByEra(blockId: number): Promise<Set<string>> {
    if (environment.NETWORK === 'kusama-assethub' || environment.NETWORK === 'polkadot-assethub') {
      const list = await this._getDistinctValidatorsAccountsByEra_AH(blockId)
      return list
    } else {
      return await this._getDistinctValidatorsAccountsByEra(blockId)
    }
  }

  async _getDistinctValidatorsAccountsByEra(blockId: number): Promise<Set<string>> {
    const blockHash = await this.getBlockHashByHeight(blockId)
    const distinctValidators: Set<string> = new Set()
    const validators = await this.polkadotApi.query.session.validators.at(blockHash)

    validators.forEach((accountId) => {
      distinctValidators.add(accountId.toString())
    })

    return distinctValidators
  }

  async _getDistinctValidatorsAccountsByEra_AH(blockId: number): Promise<Set<string>> {
    const blockHash = await this.getBlockHashByHeight(blockId)
    const apiAt = await this.polkadotApi.at(blockHash)
    const eraId = (await apiAt.query.staking.currentEra()).unwrap().toNumber()
    // 1) Preferred: list validators by their prefs keys for this era
    let keys = await apiAt.query.staking.erasValidatorPrefs.keys(eraId as any)
    // 2) Fallback: overview keys (same key tuple: [era, validatorId])
    if (!keys.length && apiAt.query.staking.erasStakersOverview?.keys) {
      keys = await apiAt.query.staking.erasStakersOverview.keys(eraId as any)
    }
    const ids = keys.map((k) => k.args[1].toString()) // [EraIndex, AccountId]
    console.log(ids)
    return new Set(ids)
  }

  async getStakersInfo(
    blockHash: TBlockHash,
    eraId: number,
    validatorAccountId: string,
  ): Promise<[any, Exposure, ValidatorPrefs]> {
    const apiAtBlock = await this.polkadotApi.at(blockHash)
    const runtime: any = await apiAtBlock.query.system.lastRuntimeUpgrade()
    if (
      runtime.unwrap().specVersion.toNumber() >= 1002000 ||
      (environment.NETWORK === 'vara' && runtime.unwrap().specVersion.toNumber() >= 1500) ||
      environment.NETWORK === 'avail'
    ) {
      this.logger.info(`Era: ${eraId}. getStakersInfoNew`)
      return this.getStakersInfoNew(apiAtBlock, eraId, validatorAccountId)
    } else {
      this.logger.info(`Era: ${eraId}. getStakersInfoOld`)
      return this.getStakersInfoOld(apiAtBlock, eraId, validatorAccountId)
    }
  }

  async getStakersInfoNew(apiAtBlock: any, eraId: number, validatorAccountId: string): Promise<[any, any, ValidatorPrefs]> {
    const [_overview, prefs] = await Promise.all([
      apiAtBlock.query.staking.erasStakersOverview(eraId, validatorAccountId),
      apiAtBlock.query.staking.erasValidatorPrefs(eraId, validatorAccountId),
    ])

    if (_overview.isNone) {
      return [{ total: BigInt(0), own: BigInt(0), others: [] }, { others: null }, prefs];
    }
    const overview: any = _overview.toJSON()
//    console.log("OVERVIEW", overview);

    const others: any = []
    for (let page = 0; page <= overview?.pageCount; page++) {
      const _staking: any = await apiAtBlock.query.staking.erasStakersPaged(eraId, validatorAccountId, page)
      //const _rewards: any = await apiAtBlock.query.staking.claimedRewards(eraId, validatorAccountId)
      //console.log(_rewards.toJSON());

      const staking = _staking.toJSON()
      if (staking && staking.others && staking.others.length) {
        staking.others.forEach((item: any) => {
          others.push({
            who: item.who,
            value: BigInt(item.value),
          })
        })
      }
    }
    //    if (overview) {
    return [{ total: BigInt(overview.total), own: BigInt(overview.own), others }, { others: null }, prefs]
    //    } else {
    //      this.logger.error("ERROR! Overview is null");
    //      return [{ total: 0, own: 0, others:0 }, { others: null }, prefs]
    //    }
  }

  async getStakersInfoOld(
    apiAtBlock: any,
    eraId: number,
    validatorAccountId: string,
  ): Promise<[Exposure, Exposure, ValidatorPrefs]> {
    const [staking, stakingClipped, prefs] = await Promise.all([
      apiAtBlock.query.staking.erasStakers(eraId, validatorAccountId),
      apiAtBlock.query.staking.erasStakersClipped(eraId, validatorAccountId),
      apiAtBlock.query.staking.erasValidatorPrefs(eraId, validatorAccountId),
    ])

    return [staking, stakingClipped, prefs]
  }

  async getStakingPayee(
    blockHash: TBlockHash,
    accountId: string,
  ): Promise<{
    reward_dest?: string
    reward_account_id?: string
  }> {
    const payee: RewardDestination = await this.polkadotApi.query.staking.payee.at(blockHash, accountId)
    let reward_dest
    let reward_account_id
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
  }

  /*
  async getEraDataStake_AH({ eraId, blockHash }: IBlockEraParams) {
    const [totalStake, bonded] = await Promise.all([
      api.query.staking.erasTotalStake.at(blockHash, eraId),
      api.query.staking.bondedEras.at(blockHash),
    ]);
    const startSession = bonded.find(([e]) => e.eq(eraId))?.[1].toNumber() ?? 0;
    return { era_id: eraId, total_stake: totalStake.toString(), session_start: startSession };
  }
  */

  async getEraDataStake({
    eraId,
    blockHash,
  }: IBlockEraParams): Promise<
    Omit<StakeEraModel, 'payout_block_id' | 'total_reward_points' | 'total_reward' | 'start_block_id'>
  > {
    this.logger.info(`getEraDataStake. eraId: ${eraId}; blockHash: ${blockHash};`)
    const [totalStake, sessionStart] = await Promise.all<[any, any]>([
      this.polkadotApi.query.staking.erasTotalStake.at(blockHash, eraId),
      environment.NETWORK === 'kusama-assethub' || environment.NETWORK === 'polkadot-assethub'
        ? this.polkadotApi.query.session.currentIndex()
        : this.polkadotApi.query.staking.erasStartSessionIndex.at(blockHash, eraId),
    ])

    this.logger.debug({ sessionStart: sessionStart.toHuman() })

    return {
      era_id: eraId,
      total_stake: totalStake.isEmpty ? '0' : totalStake.toString(),
      session_start:
        environment.NETWORK === 'kusama-assethub' || environment.NETWORK === 'polkadot-assethub'
          ? sessionStart.toNumber()
          : sessionStart.unwrap().toNumber(),
    }
  }

  async getEraDataRewards({
    eraId,
    blockHash,
  }: IBlockEraParams): Promise<Omit<RewardEraModel, 'payout_block_id' | 'total_stake' | 'session_start'>> {
    this.logger.debug({ getEraData: { eraId, blockHash } })
    const [totalReward, erasRewardPoints] = await Promise.all([
      this.polkadotApi.query.staking.erasValidatorReward.at(blockHash, eraId),
      this.polkadotApi.query.staking.erasRewardPoints.at(blockHash, eraId),
    ])

    //console.log('TOTAL REWARD', totalReward.toHuman())

    return {
      era_id: eraId,
      total_reward: totalReward.toString(),
      total_reward_points: +erasRewardPoints.total.toString(),
    }
  }

  async getBlockHashByHeight(height: number): Promise<BlockHash> {
    const hash = this.polkadotApi.rpc.chain.getBlockHash(height)
    this.logger.info(`getBlockHashByHeight: this.polkadotApi.rpc.chain.getBlockHash(${height}): ${hash}`)
    return hash
  }

  async getBlockTime(blockHash: TBlockHash): Promise<number> {
    const blockTime = await this.polkadotApi.query.timestamp.now.at(blockHash)
    return blockTime.toNumber()
  }
}

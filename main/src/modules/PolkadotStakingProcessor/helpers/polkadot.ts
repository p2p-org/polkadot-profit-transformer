import { Inject, Service } from 'typedi'
import { Logger } from 'pino'
import { ApiPromise } from '@polkadot/api'
import '@polkadot/api-augment'
import { BlockHash, Exposure, ValidatorPrefs } from '@polkadot/types/interfaces'
import { EraModel } from '@/models/era.model'
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

  async getValidatorsAndNominatorsData(args: {
    eraId: number
    eraStartBlockId: number
    blockHash: TBlockHash
    blockTime: number
  }): Promise<IGetValidatorsNominatorsResult> {
    return new Promise(async (res, rej) => {
      console.log('getValidatorsAndNominatorsData start')
      const { eraId, blockHash, blockTime, eraStartBlockId } = args
      const eraRewardPointsMap: Map<string, number> = await this.getRewardPoints(blockHash, +eraId)
      console.log({ eraRewardPointsMap })

      const nominators: NominatorModel[] = []
      const validators: ValidatorModel[] = []

      const validatorsAccountIdSet: Set<string> = await this.getDistinctValidatorsAccountsByEra(eraStartBlockId)
      // console.log({ validatorsAccountIdSet })

      const processValidator = async (validatorAccountId: string, cb: any): Promise<void> => {
        this.logger.info(`Era: ${eraId}. Process staking for validator ${validatorAccountId} `)
        const [{ total, own, others }, { others: othersClipped }, prefs] = await this.getStakersInfo(
          blockHash,
          eraId,
          validatorAccountId,
        )

        const sliceNominatorsToChunks = (arr: Vec<IndividualExposure>, chunkSize: number): Array<IndividualExposure[]> => {
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

        this.logger.info(`validator ${validatorAccountId} has ${others.length} nominators`)

        for (const chunk of nominatorsChunked) {
          const chunkResult = await Promise.all(
            chunk.map(async ({ who, value }) => {
              // console.log({ who, value })
              return {
                account_id: who.toString(),
                value: value.toString(),
                is_clipped: !!othersClipped.find((e: { who: { toString: () => any } }) => {
                  return e.who.toString() === who.toString()
                }),
                era_id: eraId,
                validator: validatorAccountId,
                ...(await this.getStakingPayee(blockHash, who.toString())),
                block_time: new Date(blockTime),
              }
            }),
          )

          nominators.push(...chunkResult)
        }

        validators.push({
          era_id: eraId,
          account_id: validatorAccountId,
          total: total.toString(),
          own: own.toString(),
          nominators_count: others.length,
          reward_points: eraRewardPointsMap.get(validatorAccountId) || 0,
          ...(await this.getStakingPayee(blockHash, validatorAccountId)),
          prefs: prefs.toJSON(),
          block_time: new Date(blockTime),
        })

        cb()
      }

      // const sliceIntoChunks = (arr: string[], chunkSize: number): Array<string[]> => {
      //   const res = []
      //   for (let i = 0; i < arr.length; i += chunkSize) {
      //     const chunk = arr.slice(i, i + chunkSize)
      //     res.push(chunk)
      //   }
      //   return res
      // }

      // const allValidatorsChunked = sliceIntoChunks(Array.from(validatorsAccountIdSet), 5)

      // for (const chunk of allValidatorsChunked) {
      //   await Promise.all(chunk.map(processValidator))
      // }

      const queue = new Queue(processValidator, { concurrent: 5 })

      // const results = []

      // queue.on('task_finish', function (taskId, result, stats) {
      //   results.push(result)
      // })

      for (const validator of Array.from(validatorsAccountIdSet)) {
        // console.log('queues.push', validator)
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

  async getRewardPoints(blockHash: TBlockHash, eraId: number): Promise<Map<string, number>> {
    const { individual } = await this.polkadotApi.query.staking.erasRewardPoints.at(blockHash, eraId)
    const eraRewardPointsMap: Map<string, number> = new Map()

    individual.forEach((rewardPoints, accountId) => {
      eraRewardPointsMap.set(accountId.toString(), rewardPoints.toNumber())
    })

    return eraRewardPointsMap
  }

  async getDistinctValidatorsAccountsByEra(blockId: number): Promise<Set<string>> {
    const blockHash = await this.getBlockHashByHeight(blockId)
    const distinctValidators: Set<string> = new Set()
    const validators = await this.polkadotApi.query.session.validators.at(blockHash)

    validators.forEach((accountId) => {
      distinctValidators.add(accountId.toString())
    })

    return distinctValidators
  }

  async getStakersInfo(
    blockHash: TBlockHash,
    eraId: number,
    validatorAccountId: string,
  ): Promise<[Exposure, Exposure, ValidatorPrefs]> {
    const [staking, stakingClipped, prefs] = await Promise.all([
      this.polkadotApi.query.staking.erasStakers.at(blockHash, eraId, validatorAccountId),
      this.polkadotApi.query.staking.erasStakersClipped.at(blockHash, eraId, validatorAccountId),
      this.polkadotApi.query.staking.erasValidatorPrefs.at(blockHash, eraId, validatorAccountId),
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
    const payee = await this.polkadotApi.query.staking.payee.at(blockHash, accountId)
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

  async getEraData({ eraId, blockHash }: IBlockEraParams): Promise<Omit<EraModel, 'payout_block_id'>> {
    this.logger.debug({ getEraData: { eraId, blockHash } })
    const [totalReward, erasRewardPoints, totalStake, sessionStart] = await Promise.all([
      this.polkadotApi.query.staking.erasValidatorReward.at(blockHash, eraId),
      this.polkadotApi.query.staking.erasRewardPoints.at(blockHash, eraId),
      this.polkadotApi.query.staking.erasTotalStake.at(blockHash, eraId),
      this.polkadotApi.query.staking.erasStartSessionIndex.at(blockHash, eraId),
    ])

    this.logger.debug({ sessionStart: sessionStart.toHuman() })

    console.log('TOTAL REWARD', totalReward.toHuman())

    return {
      era_id: eraId,
      total_reward: totalReward.toString(),
      total_stake: totalStake.isEmpty ? '0' : totalStake.toString(),
      total_reward_points: +erasRewardPoints.total.toString(),
      session_start: sessionStart.unwrap().toNumber(),
    }
  }

  async getBlockHashByHeight(height: number): Promise<BlockHash> {
    return this.polkadotApi.rpc.chain.getBlockHash(height)
  }

  async getBlockTime(blockHash: TBlockHash): Promise<number> {
    const blockTime = await this.polkadotApi.query.timestamp.now.at(blockHash)
    return blockTime.toNumber()
  }
}

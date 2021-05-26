import { AccountId, Exposure, IndividualExposure } from '@polkadot/types/interfaces'
import {
  IGetValidatorsNominatorsResult,
  IBlockEraParams,
  INominator,
  IValidator,
  IEraData,
  IStakingService,
  IProcessEraPayload
} from './staking.types'
import { ApiPromise } from '@polkadot/api'
import fastq from 'fastq'
import { IKafkaModule, KafkaModule } from '../../modules/kafka.module'
import { PolkadotModule } from '../../modules/polkadot.module'
import { ILoggerModule, LoggerModule } from '../../modules/logger.module'
import { BlockRepository } from '../../repositores/block.repository'

export default class StakingService implements IStakingService {
  private static instance: StakingService

  private readonly blockRepository: BlockRepository = BlockRepository.inject()
  private readonly kafka: IKafkaModule = KafkaModule.inject()
  private readonly polkadotApi: ApiPromise = PolkadotModule.inject()
  private readonly logger: ILoggerModule = LoggerModule.inject()
  private readonly queue: fastq.queue<IProcessEraPayload, any>;

  constructor() {
    this.queue = fastq(this, this.processEraPayout, 1)
  }

  static inject(): StakingService {
    if (!StakingService.instance) {
      StakingService.instance = new StakingService()
    }

    return StakingService.instance
  }

  addToQueue({ eraPayoutEvent, blockHash }: IProcessEraPayload): void {
    this.queue.push({ eraPayoutEvent, blockHash })
  }

  async getEraData({ eraId, blockHash }: IBlockEraParams): Promise<IEraData> {
    const [totalReward, erasRewardPoints, totalStake, sessionStart] = await Promise.all([
      this.polkadotApi.query.staking.erasValidatorReward.at(blockHash, eraId),
      this.polkadotApi.query.staking.erasRewardPoints.at(blockHash, eraId),
      this.polkadotApi.query.staking.erasTotalStake.at(blockHash, eraId),
      this.polkadotApi.query.staking.erasStartSessionIndex.at(blockHash, eraId)
    ])

    return {
      era: eraId,
      total_reward: totalReward.toString(),
      total_stake: totalStake.toString(),
      total_reward_points: +erasRewardPoints.total.toString(),
      session_start: sessionStart.unwrap().toNumber()
    }
  }

  async getValidatorsAndNominatorsData({ blockHash, eraId }: IBlockEraParams): Promise<IGetValidatorsNominatorsResult> {
    const validatorsAccountIdSet: Set<string> = new Set()
    const eraRewardPointsMap: Map<string, number> = new Map()

    const nominators: INominator[] = []
    const validators: IValidator[] = []

    const eraRewardPointsRaw = await this.polkadotApi.query.staking.erasRewardPoints.at(blockHash, +eraId)

    const firstBlockOfEra = await this.blockRepository.getFirstBlockInEra(+eraId)

    if (!firstBlockOfEra) {
      this.logger.error(`first block of era ${eraId} not found in DB`)
      throw new Error(`first block of ${eraId} not found in DB`)
    }

    const validatorsStartedEra = await this.polkadotApi.query.session.validators.at(firstBlockOfEra.hash)

    validatorsStartedEra.forEach((accountId) => {
      validatorsAccountIdSet.add(accountId.toString())
    })

    eraRewardPointsRaw.individual.forEach((rewardPoints, accountId) => {
      eraRewardPointsMap.set(accountId.toString(), rewardPoints.toNumber())
    })


    for (const validatorAccountId of validatorsAccountIdSet) {
      const [stakers, stakersClipped] = await Promise.all([
        this.polkadotApi.query.staking.erasStakers.at(blockHash, eraId, validatorAccountId),
        this.polkadotApi.query.staking.erasStakersClipped.at(blockHash, eraId, validatorAccountId)
      ])

      await this.processValidator(
          validatorAccountId,
          stakers,
          stakersClipped,
          blockHash.toString(),
          eraId,
          nominators,
          validators,
          eraRewardPointsMap
      )
    }

    return {
      validators,
      nominators
    }
  }

  async processEraPayout({ eraPayoutEvent, blockHash }: IProcessEraPayload, cb: (arg0: null) => void): Promise<void> {
    try {
      const [eraId] = eraPayoutEvent.event.data

      this.logger.debug(`Process payout for era: ${eraId}`)

      const blockTime = await this.polkadotApi.query.timestamp.now.at(blockHash)

      const eraData = await this.getEraData({ blockHash, eraId: +eraId })

      const { validators, nominators } = await this.getValidatorsAndNominatorsData({ blockHash, eraId: +eraId })

      await this.kafka.sendStakingErasData(eraData)
      await this.kafka.sendSessionData(+eraId, validators, nominators, blockTime)

      this.logger.debug(`Era ${eraId.toString()} staking processing finished`)
    } catch (error) {
      this.logger.error(`error in processing era staking: ${error}`)
    }

    cb(null)
  }

  private async processValidator(
      validatorAccountId: string,
      stakers: Exposure,
      stakersClipped: Exposure,
      blockHash: string,
      eraId: number,
      nominators: INominator[],
      validators: IValidator[],
      eraRewardPointsMap: Map<string, number>
  ) {
    const prefs = await this.polkadotApi.query.staking.erasValidatorPrefs.at(blockHash, eraId, validatorAccountId)

    this.logger.debug(
        `[validators][getStakersByValidator] Loaded stakers: ${stakers.others.length} for validator "${validatorAccountId}"`
    )

    await Promise.all(stakers.others.map((staker) => this.processStaker(
        staker,
        stakersClipped,
        eraId,
        validatorAccountId,
        blockHash,
        nominators
    )))

    let validatorRewardDest: string | undefined = undefined
    let validatorRewardAccountId: AccountId | undefined = undefined
    const validatorPayee = await this.polkadotApi.query.staking.payee.at(blockHash, validatorAccountId)
    if (validatorPayee) {
      if (!validatorPayee.isAccount) {
        validatorRewardDest = validatorPayee.toString()
      } else {
        validatorRewardDest = 'Account'
        validatorRewardAccountId = validatorPayee.asAccount
      }
    } else {
      this.logger.warn(`failed to get payee for era: "${eraId}" validator: "${validatorAccountId}". Block: ${blockHash} `)
    }

    const reward_points = eraRewardPointsMap.get(validatorAccountId) ?? 0

    validators.push({
      era: eraId,
      account_id: validatorAccountId,
      total: stakers.total.toString(),
      own: stakers.own.toString(),
      nominators_count: stakers.others.length,
      reward_points,
      reward_dest: validatorRewardDest,
      reward_account_id: validatorRewardAccountId?.toString(),
      prefs: prefs.toJSON()
    })
  }

  private async processStaker(
      staker: IndividualExposure,
      stakersClipped: Exposure,
      eraId: number,
      validatorAccountId: string,
      blockHash: string,
      nominators: INominator[]
  ) {
    try {
      const isClipped = stakersClipped.others.find((e: { who: { toString: () => any } }) => {
        return e.who.toString() === staker.who.toString()
      })

      const nominator: INominator = {
        era: eraId,
        account_id: staker.who.toString(),
        validator: validatorAccountId,
        is_clipped: !!isClipped,
        value: staker.value.toString()
      }

      const payee = await this.polkadotApi.query.staking.payee.at(blockHash, staker.who.toString())
      if (payee) {
        if (!payee.isAccount) {
          nominator.reward_dest = payee.toString()
        } else {
          nominator.reward_dest = 'Account'
          nominator.reward_account_id = payee.asAccount
        }
      }

      nominators.push(nominator)
    } catch (e) {
      this.logger.error(`[validators][getValidators] Cannot process staker: ${staker.who} "${e}". Block: ${blockHash}`)
    }
  }
}

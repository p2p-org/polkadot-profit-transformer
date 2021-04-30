import { IBlock } from './../watchdog/watchdog.types'
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
import { FastifyInstance } from 'fastify'
import { ApiPromise } from '@polkadot/api'
import { Producer } from 'kafkajs'
import fastq from 'fastq'
import { Pool } from 'pg'

const {
  environment: { KAFKA_PREFIX, DB_SCHEMA }
} = require('../../environment')

export default class StakingService implements IStakingService {
  static instance: StakingService
  private readonly app: FastifyInstance
  private readonly polkadotConnector: ApiPromise
  private readonly kafkaProducer: Producer
  private readonly queue: any
  private postgresConnector: Pool

  constructor(app: FastifyInstance) {
    this.app = app
    this.polkadotConnector = app.polkadotConnector
    this.kafkaProducer = app.kafkaProducer
    this.postgresConnector = app.postgresConnector
    this.queue = fastq(this, this.processEraPayout, 1)
  }

  static getInstance(app: FastifyInstance): StakingService {
    if (!StakingService.instance) {
      StakingService.instance = new StakingService(app)
    }

    return StakingService.instance
  }

  addToQueue({ eraPayoutEvent, blockHash }: IProcessEraPayload): void {
    this.queue.push({ eraPayoutEvent, blockHash })
  }

  async getEraData({ eraId, blockHash }: IBlockEraParams): Promise<IEraData> {
    const [totalReward, erasRewardPoints, totalStake, sessionStart] = await Promise.all([
      this.polkadotConnector.query.staking.erasValidatorReward.at(blockHash, eraId),
      this.polkadotConnector.query.staking.erasRewardPoints.at(blockHash, eraId),
      this.polkadotConnector.query.staking.erasTotalStake.at(blockHash, eraId),
      this.polkadotConnector.query.staking.erasStartSessionIndex.at(blockHash, eraId)
    ])

    return {
      era: eraId,
      total_reward: totalReward.toString(),
      total_stake: totalStake.toString(),
      total_reward_points: +erasRewardPoints.total.toString(),
      session_start: sessionStart.unwrap().toNumber()
    }
  }

  async getFirstBlockInSession(sessionId: number): Promise<IBlock> {
    try {
      const { rows } = await this.postgresConnector.query({
        text: `SELECT * FROM ${DB_SCHEMA}.blocks WHERE "session_id" = $1::int order by "id" limit 1`,
        values: [sessionId]
      })

      return rows[0]
    } catch (err) {
      this.app.log.error(`failed to get first block of session ${sessionId}, error: ${err}`)
      throw new Error('cannot find first era block')
    }
  }

  async getValidatorsAndNominatorsData({ blockHash, eraId }: IBlockEraParams): Promise<IGetValidatorsNominatorsResult> {
    const validatorsAccountIdSet: Set<string> = new Set()
    const eraRewardPointsMap: Map<string, number> = new Map()

    const nominators: INominator[] = []
    const validators: IValidator[] = []

    const eraRewardPointsRaw = await this.polkadotConnector.query.staking.erasRewardPoints.at(blockHash, +eraId)
    const sessionStart = await this.polkadotConnector.query.staking.erasStartSessionIndex(+eraId)

    const firstBlockOfEra = await this.getFirstBlockInSession(+sessionStart)

    if (!firstBlockOfEra) {
      this.app.log.error(`first block of era ${eraId} not found in DB`)
      throw new Error(`first block of ${eraId} not found in DB`)
    }

    const validatorsStartedEra = await this.polkadotConnector.query.session.validators.at(firstBlockOfEra.hash)

    validatorsStartedEra.forEach((accountId) => {
      validatorsAccountIdSet.add(accountId.toString())
    })

    eraRewardPointsRaw.individual.forEach((rewardPoints, accountId) => {
      eraRewardPointsMap.set(accountId.toString(), rewardPoints.toNumber())
    })

    const processValidator = async (validatorAccountId: string, stakers: Exposure, stakersClipped: Exposure) => {
      const prefs = await this.polkadotConnector.query.staking.erasValidatorPrefs.at(blockHash, eraId, validatorAccountId)

      this.app.log.debug(
        `[validators][getStakersByValidator] Loaded stakers: ${stakers.others.length} for validator "${validatorAccountId}"`
      )

      const processStaker = async (staker: IndividualExposure) => {
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

          const payee = await this.polkadotConnector.query.staking.payee.at(blockHash, staker.who.toString())
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
          this.app.log.error(`[validators][getValidators] Cannot process staker: ${staker.who} "${e}". Block: ${blockHash}`)
        }
      }

      await Promise.all(stakers.others.map((staker) => processStaker(staker)))

      let validatorRewardDest: string | undefined = undefined
      let validatorRewardAccountId: AccountId | undefined = undefined
      const validatorPayee = await this.polkadotConnector.query.staking.payee.at(blockHash, validatorAccountId)
      if (validatorPayee) {
        if (!validatorPayee.isAccount) {
          validatorRewardDest = validatorPayee.toString()
        } else {
          validatorRewardDest = 'Account'
          validatorRewardAccountId = validatorPayee.asAccount
        }
      } else {
        this.app.log.warn(`failed to get payee for era: "${eraId}" validator: "${validatorAccountId}". Block: ${blockHash} `)
      }

      const pointsFromMap = eraRewardPointsMap.get(validatorAccountId) ?? 0
      const reward_points = pointsFromMap

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

    for (const validatorAccountId of validatorsAccountIdSet) {
      const [stakers, stakersClipped] = await Promise.all([
        this.polkadotConnector.query.staking.erasStakers.at(blockHash, eraId, validatorAccountId),
        this.polkadotConnector.query.staking.erasStakersClipped.at(blockHash, eraId, validatorAccountId)
      ])

      await processValidator(validatorAccountId, stakers, stakersClipped)
    }

    return {
      validators,
      nominators
    }
  }

  async processEraPayout({ eraPayoutEvent, blockHash }: IProcessEraPayload, cb: (arg0: null) => void): Promise<void> {
    try {
      const [eraId] = eraPayoutEvent.event.data

      this.app.log.debug(`Process payout for era: ${eraId}`)

      const blockTime = await this.polkadotConnector.query.timestamp.now.at(blockHash)

      const eraData = await this.getEraData({ blockHash, eraId: +eraId })

      const { validators, nominators } = await this.getValidatorsAndNominatorsData({ blockHash, eraId: +eraId })

      try {
        await this.kafkaProducer.send({
          topic: KAFKA_PREFIX + '_STAKING_ERAS_DATA',
          messages: [
            {
              key: eraData.era.toString(),
              value: JSON.stringify(eraData)
            }
          ]
        })
      } catch (error: any) {
        this.app.log.error(`failed to push era data: `, error)
        throw new Error('cannot push session data to Kafka')
      }

      try {
        await this.kafkaProducer.send({
          topic: KAFKA_PREFIX + '_SESSION_DATA',
          messages: [
            {
              // key: blockData.block.header.number.toString(),
              value: JSON.stringify({
                era: +eraId.toString(),
                validators: validators.map((validator) => ({ ...validator, block_time: blockTime.toNumber() })),
                nominators: nominators.map((nominator) => ({ ...nominator, block_time: blockTime.toNumber() })),
                block_time: blockTime.toNumber()
              })
            }
          ]
        })
      } catch (error: any) {
        this.app.log.error(`failed to push session data: `, error)
        throw new Error('cannot push session data to Kafka')
      }

      this.app.log.debug(`Era ${eraId.toString()} staking processing finished`)
    } catch (error) {
      this.app.log.error(`error in processing era staking: ${error}`)
    }

    cb(null)
  }
}

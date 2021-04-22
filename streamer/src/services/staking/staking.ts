import { AccountId, EventRecord } from '@polkadot/types/interfaces'
import { TBlockHash, INominator, IValidator, IEraData } from './staking.types'
import { FastifyInstance } from 'fastify'
import { ApiPromise } from '@polkadot/api'
import { Producer } from 'kafkajs'

const {
  environment: { KAFKA_PREFIX }
} = require('../../environment')

let app: FastifyInstance
let polkadotConnector: ApiPromise
let kafkaProducer: Producer

interface IBlockEraParams {
  eraId: number
  blockHash: TBlockHash
}

const getEraData = async ({ eraId, blockHash }: IBlockEraParams): Promise<IEraData> => {
  const [totalReward, erasRewardPoints, totalStake, sessionStart] = await Promise.all([
    polkadotConnector.query.staking.erasValidatorReward.at(blockHash, eraId),
    polkadotConnector.query.staking.erasRewardPoints.at(blockHash, eraId),
    polkadotConnector.query.staking.erasTotalStake.at(blockHash, eraId),
    polkadotConnector.query.staking.erasStartSessionIndex.at(blockHash, eraId)
  ])

  return {
    era: eraId,
    total_reward: totalReward.toString(),
    total_stake: totalStake.toString(),
    total_reward_points: +erasRewardPoints.total.toString(),
    session_start: sessionStart.unwrap().toNumber()
  }
}

const getValidatorsAndNominatorsData = async ({ blockHash, eraId }: IBlockEraParams) => {
  const validatorsAccountIdSet: Set<string> = new Set()
  const eraRewardPointsMap: Map<string, number> = new Map()

  const nominators: INominator[] = []
  const validators: IValidator[] = []

  const eraRewardPointsRaw = await polkadotConnector.query.staking.erasRewardPoints.at(blockHash, +eraId)

  eraRewardPointsRaw.individual.forEach((rewardPoints, accountId) => {
    validatorsAccountIdSet.add(accountId.toString())
    eraRewardPointsMap.set(accountId.toString(), rewardPoints.toNumber())
  })

  const processValidator = async (validatorAccountId: string) => {
    const [prefs, stakers, stakersClipped] = await Promise.all([
      await polkadotConnector.query.staking.erasValidatorPrefs.at(blockHash, eraId, validatorAccountId),
      await polkadotConnector.query.staking.erasStakers.at(blockHash, eraId, validatorAccountId),
      await polkadotConnector.query.staking.erasStakersClipped.at(blockHash, eraId, validatorAccountId)
    ])

    app.log.debug(`[validators][getStakersByValidator] Loaded stakers: ${stakers.others.length} for validator "${validatorAccountId}"`)

    for (const staker of stakers.others) {
      try {
        const isClipped = stakersClipped.others.find((e: { who: { toString: () => any } }) => {
          return e.who.toString() === staker.who.toString()
        })

        const nominator: INominator = {
          era: eraId,
          account_id: staker.who.toString(),
          validator: validatorAccountId,
          is_clipped: !isClipped,
          value: staker.value.toString()
        }

        const payee = await polkadotConnector.query.staking.payee.at(blockHash, staker.who.toString())
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
        app.log.error(`[validators][getValidators] Cannot process staker: ${staker.who} "${e}". Block: ${blockHash}`)
      }
    }

    let validatorRewardDest: string | undefined = undefined
    let validatorRewardAccountId: AccountId | undefined = undefined
    const validatorPayee = await polkadotConnector.query.staking.payee.at(blockHash, validatorAccountId)
    if (validatorPayee) {
      if (!validatorPayee.isAccount) {
        validatorRewardDest = validatorPayee.toString()
      } else {
        validatorRewardDest = 'Account'
        validatorRewardAccountId = validatorPayee.asAccount
      }
    } else {
      app.log.warn(`failed to get payee for era: "${eraId}" validator: "${validatorAccountId}". Block: ${blockHash} `)
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

  const validatorsProcessTasks = []

  for (const validatorAccountId of validatorsAccountIdSet) {
    validatorsProcessTasks.push(processValidator(validatorAccountId))
  }

  await Promise.all(validatorsProcessTasks)

  return {
    validators,
    nominators
  }
}

const processEraPayout = async (eraPayoutEvent: EventRecord, blockHash: TBlockHash) => {
  const [eraId] = eraPayoutEvent.event.data

  // TODO: Add node HISTORY_DEPTH checking
  // const currentEra = await polkadotConnector.query.staking.currentEra()
  // const historyDepth = await polkadotConnector.query.staking.historyDepth.at(blockHash)
  // if (currentEra.unwrap().toNumber() - +eraId > historyDepth.toNumber()) {
  //   app.log.warn(`The block height less than HISTORY_DEPTH value: ${historyDepth.toNumber()}`)
  // }

  app.log.debug(`Process payout for era: ${eraId}`)
  // await this.updateMetaData(blockHash)

  const blockTime = await polkadotConnector.query.timestamp.now.at(blockHash)

  const eraData = await getEraData({ blockHash, eraId: +eraId })

  const { validators, nominators } = await getValidatorsAndNominatorsData({ blockHash, eraId: +eraId })

  try {
    await kafkaProducer.send({
      topic: KAFKA_PREFIX + '_STAKING_ERAS_DATA',
      messages: [
        {
          key: eraData.era.toString(),
          value: JSON.stringify(eraData)
        }
      ]
    })
  } catch (error: any) {
    app.log.error(`failed to push era data: `, error)
    throw new Error('cannot push session data to Kafka')
  }

  try {
    await kafkaProducer.send({
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
    app.log.error(`failed to push session data: `, error)
    throw new Error('cannot push session data to Kafka')
  }
}

export const addEraToProcessingQueue = (() => {
  let pending = Promise.resolve()

  const run = async (eraPayoutEvent: EventRecord, blockHash: TBlockHash) => {
    try {
      await pending
    } finally {
      return processEraPayout(eraPayoutEvent, blockHash)
    }
  }

  return (eraPayoutEvent: EventRecord, blockHash: TBlockHash) => (pending = run(eraPayoutEvent, blockHash))
})()

export const init = (appParam: FastifyInstance): void => {
  app = appParam
  polkadotConnector = app.polkadotConnector
  kafkaProducer = app.kafkaProducer
}

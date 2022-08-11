import { IndividualExposure } from '@polkadot/types/interfaces'
import { PolkadotRepository } from 'apps/common/infra/polkadotapi/polkadot.repository'
import { StakingRepository } from './../../apps/common/infra/postgresql/staking.repository'
import { logger } from '@apps/common/infra/logger/logger'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@apps/common/infra/postgresql/models/processing_task.model'
import { Knex } from 'knex'
import { v4 } from 'uuid'
import { IGetValidatorsNominatorsResult, TBlockHash } from './staking.types'
import { NominatorModel } from '@apps/common/infra/postgresql/models/nominator.model'
import { ValidatorModel } from '@apps/common/infra/postgresql/models/validator.model'
import { Vec } from '@polkadot/types'
import Queue from 'better-queue'
import { resolve } from 'path'

export const processEraPayout = async (
  metadata: any,
  eraId: number,
  payout_block_id: number,
  collect_uid: string,
  trx: Knex.Transaction<any, any[]>,
  stakingRepository: StakingRepository,
  polkadotRepository: PolkadotRepository,
): Promise<ProcessingTaskModel<ENTITY.ERA> | undefined> => {
  const getValidatorsAndNominatorsData = async (args: {
    eraId: number
    eraStartBlockId: number
    blockHash: TBlockHash
    blockTime: number
  }): Promise<IGetValidatorsNominatorsResult> => {
    return new Promise(async (res, rej) => {
      console.log('getValidatorsAndNominatorsData start')
      const { eraId, blockHash, blockTime, eraStartBlockId } = args
      const eraRewardPointsMap: Map<string, number> = await polkadotRepository.getRewardPoints(blockHash, +eraId)
      console.log({ eraRewardPointsMap })

      const nominators: NominatorModel[] = []
      const validators: ValidatorModel[] = []

      const validatorsAccountIdSet: Set<string> = await polkadotRepository.getDistinctValidatorsAccountsByEra(eraStartBlockId)
      // console.log({ validatorsAccountIdSet })

      const processValidator = async (validatorAccountId: string, cb: any): Promise<void> => {
        logger.info(`Era: ${eraId}. Process staking for validator ${validatorAccountId} `)
        const [{ total, own, others }, { others: othersClipped }, prefs] = await polkadotRepository.getStakersInfo(
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

        logger.info(`validator ${validatorAccountId} has ${others.length} nominators`)

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
                era: eraId,
                validator: validatorAccountId,
                ...(await polkadotRepository.getStakingPayee(blockHash, who.toString())),
                block_time: new Date(blockTime),
              }
            }),
          )

          nominators.push(...chunkResult)
        }

        validators.push({
          era: eraId,
          account_id: validatorAccountId,
          total: total.toString(),
          own: own.toString(),
          nominators_count: others.length,
          reward_points: eraRewardPointsMap.get(validatorAccountId) || 0,
          ...(await polkadotRepository.getStakingPayee(blockHash, validatorAccountId)),
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

      for (let validator of Array.from(validatorsAccountIdSet)) {
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

  const start = Date.now()
  logger.info({ event: `Process staking payout for era: ${eraId}`, metadata, eraId })

  const eraStartBlockId = await stakingRepository(trx).era.findEraStartBlockId(eraId)

  // if no eraStartBlockId - recreate task in rabbit
  if (eraStartBlockId !== 0 && !eraStartBlockId) {
    const reprocessingTask: ProcessingTaskModel<ENTITY.ERA> = {
      entity: ENTITY.ERA,
      entity_id: eraId,
      status: PROCESSING_STATUS.NOT_PROCESSED,
      collect_uid,
      start_timestamp: new Date(),
      attempts: 0,
      data: { payout_block_id },
    }
    logger.warn({
      event: 'process-payouts eraStartBlockId not found, resend task to rabbit',
      reprocessingTask,
    })

    return reprocessingTask
  }

  // logger.info({ eraStartBlockId })

  const blockHash = await polkadotRepository.getBlockHashByHeight(payout_block_id)

  // logger.info({ blockHash })

  try {
    const blockTime = await polkadotRepository.getBlockTime(blockHash)

    const eraData = await polkadotRepository.getEraData({ blockHash, eraId })

    logger.info({
      event: 'process-payout',
      eraData,
    })

    const { validators, nominators } = await getValidatorsAndNominatorsData({ blockHash, eraStartBlockId, eraId, blockTime })

    await stakingRepository(trx).era.save({ ...eraData, payout_block_id: payout_block_id })

    for (const validator of validators) {
      await stakingRepository(trx).validators.save(validator)
    }

    for (const nominator of nominators) {
      await stakingRepository(trx).nominators.save(nominator)
    }

    const finish = Date.now()

    logger.info({
      event: `Era ${eraId.toString()} staking processing finished in ${(finish - start) / 1000} seconds.`,
      metadata,
      eraId,
    })
  } catch (error: any) {
    logger.warn({
      event: `error in processing era staking: ${error.message}`,
    })
    throw error
  }
}

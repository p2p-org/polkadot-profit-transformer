import { ValidatorModel } from './../../apps/common/infra/postgresql/models/validator.model'
import { NominatorModel } from './../../apps/common/infra/postgresql/models/nominator.model'
import { StakingRepository } from './../../apps/common/infra/postgresql/staking.repository'
import { Logger } from './../../apps/common/infra/logger/logger'
import { PolkadotRepository } from 'apps/common/infra/polkadotapi/polkadot.repository'
import { IGetValidatorsNominatorsResult, TBlockHash } from './staking.types'
import { StreamerRepository } from 'apps/common/infra/postgresql/streamer.repository'
import { Vec } from '@polkadot/types'
import { IndividualExposure } from '@polkadot/types/interfaces'

export type StakingProcessor = ReturnType<typeof StakingProcessor>

export const StakingProcessor = (args: {
  polkadotRepository: PolkadotRepository
  streamerRepository: StreamerRepository
  stakingRepository: StakingRepository
  logger: Logger
}) => {
  const { polkadotRepository, streamerRepository, stakingRepository, logger } = args

  const getValidatorsAndNominatorsData = async (args: {
    eraId: number
    blockHash: TBlockHash
    blockTime: number
  }): Promise<IGetValidatorsNominatorsResult> => {
    const { eraId, blockHash, blockTime } = args
    const eraRewardPointsMap: Map<string, number> = await polkadotRepository.getRewardPoints(blockHash, +eraId)

    const nominators: NominatorModel[] = []
    const validators: ValidatorModel[] = []

    const firstBlockOfEra = await streamerRepository.blocks.getFirstBlockInEra(eraId)

    if (!firstBlockOfEra) throw Error('StakingProcessor first block in era' + eraId + ' not found')

    const validatorsAccountIdSet: Set<string> = await polkadotRepository.getDistinctValidatorsAccountsByEra(firstBlockOfEra.hash)

    const processValidator = async (validatorAccountId: string): Promise<void> => {
      logger.info(`Process staking for validator ${validatorAccountId} `)
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
        process.env.NOMINATORS_CUNCURRENCY ? Number(process.env.NOMINATORS_CUNCURRENCY) : 10,
      )

      logger.info(`validator ${validatorAccountId} has ${others.length} nominators`)

      for (const chunk of nominatorsChunked) {
        // this.logger.info({ chunk })
        const chunkResult = await Promise.all(
          chunk.map(async ({ who, value }) => {
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
    }

    const sliceIntoChunks = (arr: string[], chunkSize: number): Array<string[]> => {
      const res = []
      for (let i = 0; i < arr.length; i += chunkSize) {
        const chunk = arr.slice(i, i + chunkSize)
        res.push(chunk)
      }
      return res
    }

    const allValidatorsChunked = sliceIntoChunks(Array.from(validatorsAccountIdSet), 1)

    for (const chunk of allValidatorsChunked) {
      await Promise.all(chunk.map(processValidator))
    }

    return {
      validators,
      nominators,
    }
  }

  const processEraPayout = async (eraId: number): Promise<void> => {
    const start = Date.now()
    logger.info(`Process staking payout for era: ${eraId}`)

    const eraPayoutEvent = await streamerRepository.events.findEraPayoutEvent({ eraId })

    logger.debug({ eraPayoutEvent })

    if (!eraPayoutEvent) {
      throw new Error(`Staking processor: eraPaid event for eraId: ${eraId} not found`)
    }

    const blockHash = await polkadotRepository.getBlockHashByHeight(eraPayoutEvent.block_id)

    logger.debug({ blockHash })

    try {
      const blockTime = await polkadotRepository.getBlockTime(blockHash)

      const eraData = await polkadotRepository.getEraData({ blockHash, eraId })

      const { validators, nominators } = await getValidatorsAndNominatorsData({ blockHash, eraId, blockTime })

      await stakingRepository.era.save(eraData)

      for (const validator of validators) {
        await stakingRepository.validators.save(validator)
      }

      for (const nominator of nominators) {
        await stakingRepository.nominators.save(nominator)
      }

      const finish = Date.now()

      logger.info(`Era ${eraId.toString()} staking processing finished in ${(finish - start) / 1000} seconds.`)
    } catch (error: any) {
      logger.info(`error in processing era staking: ${error.message}`)
      throw error
    }
  }

  return {
    process: async (eraId: number): Promise<void> => {
      logger.debug('staking processor: process era' + eraId)
      await processEraPayout(eraId)
    },
  }
}

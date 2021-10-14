import {
  IGetValidatorsNominatorsResult,
  IBlockEraParams,
  INominator,
  IValidator,
  IStakingService,
  IProcessEraPayload
} from './staking.types'
import fastq from 'fastq'
import { IKafkaModule, KafkaModule } from '@modules/kafka'
import { PolkadotModule } from '@modules/polkadot.module'
import { ILoggerModule, LoggerModule } from '@modules/logger.module'
import { BlockRepository } from '@repositories/block.repository'

export class StakingService implements IStakingService {
  private static instance: StakingService

  private readonly blockRepository: BlockRepository = BlockRepository.inject()
  private readonly kafka: IKafkaModule = KafkaModule.inject()
  private readonly polkadotApi: PolkadotModule = PolkadotModule.inject()
  private readonly logger: ILoggerModule = LoggerModule.inject()
  private readonly queue: fastq.queue<IProcessEraPayload>

  constructor() {
    this.queue = fastq(this, this.processEraPayout, 1)
  }

  static inject(): StakingService {
    if (!StakingService.instance) {
      StakingService.instance = new StakingService()
    }

    return StakingService.instance
  }

  addToQueue({ eraId, blockHash }: IProcessEraPayload): void {
    this.queue.push({ eraId, blockHash })
  }

  async getValidatorsAndNominatorsData({ blockHash, eraId }: IBlockEraParams): Promise<IGetValidatorsNominatorsResult> {
    const eraRewardPointsMap: Map<string, number> = await this.polkadotApi.getRewardPoints(blockHash, +eraId)

    const nominators: INominator[] = []
    const validators: IValidator[] = []

    const firstBlockOfEra = await this.blockRepository.getFirstBlockInEra(+eraId)

    if (!firstBlockOfEra) {
      this.logger.error(`first block of era ${eraId} not found in DB`)
      throw new Error(`first block of ${eraId} not found in DB`)
    }

    const validatorsAccountIdSet: Set<string> = await this.polkadotApi.getDistinctValidatorsAccountsByEra(firstBlockOfEra.hash)

    const processValidator = async (validatorAccountId: string): Promise<void> => {
      this.logger.info(`Process staking for validator ${validatorAccountId} `)
      const [{ total, own, others }, { others: othersClipped }, prefs] = await this.polkadotApi.getStakersInfo(
        blockHash,
        eraId,
        validatorAccountId
      )

      const newNominators = await Promise.all(
        others.map(async ({ who, value }) => {
          return {
            account_id: who.toString(),
            value: value.toString(),
            is_clipped: !!othersClipped.find((e: { who: { toString: () => any } }) => {
              return e.who.toString() === who.toString()
            }),
            era: eraId,
            validator: validatorAccountId,
            ...(await this.polkadotApi.getStakingPayee(blockHash, who.toString()))
          }
        })
      )

      nominators.push(...newNominators)

      validators.push({
        era: eraId,
        account_id: validatorAccountId,
        total: total.toString(),
        own: own.toString(),
        nominators_count: newNominators.length,
        reward_points: eraRewardPointsMap.get(validatorAccountId) || 0,
        ...(await this.polkadotApi.getStakingPayee(blockHash, validatorAccountId)),
        prefs: prefs.toJSON()
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

    const allValidatorsChunked = sliceIntoChunks(Array.from(validatorsAccountIdSet), 30)

    for (const chunk of allValidatorsChunked) {
      await Promise.all(chunk.map(processValidator))
    }

    return {
      validators,
      nominators
    }
  }

  async processEraPayout({ eraId, blockHash }: IProcessEraPayload, cb: (arg0: null) => void): Promise<void> {
    try {
      this.logger.debug(`Process payout for era: ${eraId}`)

      const blockTime = await this.polkadotApi.getBlockTime(blockHash)

      const eraData = await this.polkadotApi.getEraData({ blockHash, eraId: +eraId })

      const { validators, nominators } = await this.getValidatorsAndNominatorsData({ blockHash, eraId: +eraId })

      await this.kafka.sendStakingErasData(eraData)
      await this.kafka.sendSessionData(+eraId, validators, nominators, blockTime)

      this.logger.info(`Era ${eraId.toString()} staking processing finished`)
    } catch (error) {
      this.logger.error({ error }, `error in processing era staking`)
    }

    cb(null)
  }
}

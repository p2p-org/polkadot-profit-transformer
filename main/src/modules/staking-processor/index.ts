// import { ValidatorModel } from './../../apps/common/infra/postgresql/models/validator.model'
// import { NominatorModel } from './../../apps/common/infra/postgresql/models/nominator.model'
// import { StakingRepository } from './../../apps/common/infra/postgresql/staking.repository'
// import { Logger } from './../../apps/common/infra/logger/logger'
// import { PolkadotRepository } from 'apps/common/infra/polkadotapi/polkadot.repository'
// import fastq from 'fastq'
// import { IGetValidatorsNominatorsResult, TBlockHash } from './staking.types'
// import { StreamerRepository } from 'apps/common/infra/postgresql/streamer.repository'
// import { EventModel } from 'apps/common/infra/postgresql/models/event.model'

// export type StakingProcessor = ReturnType<typeof StakingProcessor>

// export const StakingProcessor = (args: {
//   polkadotRepository: PolkadotRepository
//   streamerRepository: StreamerRepository
//   stakingRepository: StakingRepository
//   logger: Logger
// }) => {
//   const { polkadotRepository, streamerRepository, stakingRepository, logger } = args

//   const getValidatorsAndNominatorsData = async (args: {
//     eraId: number
//     blockHash: TBlockHash
//     blockTime: number
//   }): Promise<IGetValidatorsNominatorsResult> => {
//     const { eraId, blockHash, blockTime } = args
//     const eraRewardPointsMap: Map<string, number> = await polkadotRepository.getRewardPoints(blockHash, +eraId)

//     const nominators: NominatorModel[] = []
//     const validators: ValidatorModel[] = []

//     const firstBlockOfEra = await streamerRepository.blocks.getFirstBlockInEra(eraId)

//     if (!firstBlockOfEra) throw Error('StakingProcessor first block in era' + eraId + ' not found')

//     const validatorsAccountIdSet: Set<string> = await polkadotRepository.getDistinctValidatorsAccountsByEra(firstBlockOfEra.hash)

//     const processValidator = async (validatorAccountId: string): Promise<void> => {
//       logger.info(`Process staking for validator ${validatorAccountId} `)
//       const [{ total, own, others }, { others: othersClipped }, prefs] = await polkadotRepository.getStakersInfo(
//         blockHash,
//         eraId,
//         validatorAccountId,
//       )

//       const newNominators = await Promise.all(
//         others.map(async ({ who, value }) => {
//           return {
//             account_id: who.toString(),
//             value: value.toString(),
//             is_clipped: !!othersClipped.find((e: { who: { toString: () => any } }) => {
//               return e.who.toString() === who.toString()
//             }),
//             era: eraId,
//             validator: validatorAccountId,
//             ...(await polkadotRepository.getStakingPayee(blockHash, who.toString())),
//             block_time: new Date(blockTime),
//           }
//         }),
//       )

//       nominators.push(...newNominators)

//       validators.push({
//         era: eraId,
//         account_id: validatorAccountId,
//         total: total.toString(),
//         own: own.toString(),
//         nominators_count: newNominators.length,
//         reward_points: eraRewardPointsMap.get(validatorAccountId) || 0,
//         ...(await polkadotRepository.getStakingPayee(blockHash, validatorAccountId)),
//         prefs: prefs.toJSON(),
//         block_time: new Date(blockTime),
//       })
//     }

//     await Promise.all(Array.from(validatorsAccountIdSet).map(processValidator))

//     return {
//       validators,
//       nominators,
//     }
//   }

//   // const processEraPayout = async (event: EventModel, cb: (arg0: null) => void): Promise<void> => {
//   //   const eraId = event.event.data[0]

//   //   console.log('processEraPayout for era: ', eraId)

//   //   const blockHash = await polkadotRepository.getBlockHashByHeight(event.block_id)

//   //   try {
//   //     const blockTime = await polkadotRepository.getBlockTime(blockHash)

//   //     const eraData = await polkadotRepository.getEraData({ blockHash, eraId })

//   //     const { validators, nominators } = await getValidatorsAndNominatorsData({ blockHash, eraId, blockTime })

//   //     await stakingRepository.era.save(eraData)

//   //     for (const validator of validators) {
//   //       await stakingRepository.validators.save(validator)
//   //     }

//   //     for (const nominator of nominators) {
//   //       await stakingRepository.nominators.save(nominator)
//   //     }

//   //     logger.info(`Era ${eraId.toString()} staking processing finished`)
//   //   } catch (error) {
//   //     logger.error({ error }, `error in processing era staking`)
//   //     throw error
//   //   }

//   //   cb(null)
//   // }

//   // const queue = fastq(this, processEraPayout, 1)

//   // return {
//   //   addToQueue(event: EventModel): void {
//   //     logger.info('StakingProcessor addToQueue event processing started from event: ' + JSON.stringify(event))
//   //     queue.push(event)
//   //   },
//   // }
// }

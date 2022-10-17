import { IndividualExposure } from '@polkadot/types/interfaces'
import { Vec } from '@polkadot/types'
import Queue from 'better-queue'
import { resolve } from 'path'
import { Knex } from 'knex'
import { v4 } from 'uuid'
import { logger } from '@/loaders/logger'
import { PolkadotRepository } from '@/apps/common/infra/polkadotapi/polkadot.repository'
import { StakingRepository } from '@/apps/common/infra/postgresql/staking.repository'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@/models/processing_task.model'
import { DelegatorModel } from '@/models/delegator.model'
import { CollatorModel } from '@/models/collator.model'
import { IGetCollatorsDeligatorsResult, TBlockHash } from './staking.types'
import { CollatorModel } from '../../models/collator.model'
import { reward } from './api'
import { ApiPromise } from '@polkadot/api'
import { idText } from 'typescript'

export const processRoundPayout = async (
  metadata: any,
  roundId: number,
  payout_block_id: number,
  collect_uid: string,
  trx: Knex.Transaction<any, any[]>,
  stakingRepository: StakingRepository,
  polkadotRepository: PolkadotRepository,
  polkadotApi: ApiPromise
): Promise<ProcessingTaskModel<ENTITY.ERA> | undefined> => {

  const start = Date.now()
  logger.info({ event: `Process staking payout for era: ${roundId}`, metadata, roundId })

  try {
    const { round, stakedValue } = await reward(polkadotApi, payout_block_id);

    console.log("ROUND", {
      round_id: parseInt(round.id.toString(10)),
      payout_block_id: parseInt(round.payoutBlockId),
      payout_block_time: new Date(parseInt(round.payoutBlockTime)),
      start_block_id: parseInt(round.startBlockId),
      start_block_time: new Date(parseInt(round.startBlockTime)),
      total_reward: round.totalRewardedAmount.toString(10),
      total_stake: round.totalStaked.toString(10),
      total_reward_points: parseInt(round.totalPoints.toString(10)),
      collators_count: stakedValue.length,
    });

    await stakingRepository(trx).round.save({
      round_id: parseInt(round.id.toString(10)),
      payout_block_id: parseInt(round.payoutBlockId),
      payout_block_time: new Date(parseInt(round.payoutBlockTime)),
      start_block_id: parseInt(round.startBlockId),
      start_block_time: new Date(parseInt(round.startBlockTime)),
      total_reward: round.totalRewardedAmount.toString(10),
      total_stake: round.totalStaked.toString(10),
      total_reward_points: parseInt(round.totalPoints.toString(10)),
      collators_count: stakedValue.length,
    });

    for (const collator of Object.values(stakedValue)) {

      await stakingRepository(trx).collators.save({
        round_id: parseInt(round.id.toString(10)),
        account_id: collator.id,
        total_stake: collator.total.toString(10),
        own_stake: collator.bond.toString(10),
        delegators_count: Object.keys(collator.delegators).length,
        reward_points: parseInt(collator.points.toString(10)),
        reward: collator.reward.total.toString(10),
        payout_block_id: parseInt(collator.payoutBlockId),
        payout_block_time: new Date(collator.payoutBlockTime),
      })

      for (const delegator of Object.values(collator.delegators)) {
        await stakingRepository(trx).delegators.save({
          round_id: parseInt(round.id.toString(10)),
          account_id: delegator.id,
          collator_id: collator.id,
          amount: delegator.amount.toString(10),
          reward: delegator.reward.toString(10),
          payout_block_id: parseInt(collator.payoutBlockId),
          payout_block_time: new Date(collator.payoutBlockTime),
          //block_time: blockTime
        })
      }
    }


    const finish = Date.now()

    logger.info({
      event: `Round ${roundId.toString()} staking processing finished in ${(finish - start) / 1000} seconds.`,
      metadata,
      roundId,
    })

  } catch (error: any) {
    console.error(error);
    logger.warn({
      event: `error in processing round staking: ${error.message}`,
    })
    throw error
  }
}

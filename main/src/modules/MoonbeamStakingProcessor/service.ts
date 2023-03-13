import { Container, Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { v4 } from 'uuid'
import { ApiPromise } from '@polkadot/api'
//import { PolkadotRepository } from '@/apps/common/infra/polkadotapi/polkadot.repository'
import { logger } from '@/loaders/logger'
import { QUEUES, Rabbit, TaskMessage } from '@/loaders/rabbitmq'
import { ENTITY, PROCESSING_STATUS } from '@/models/processing_task.model'
import { TasksRepository } from '@/libs/tasks.repository'
import { MoonbeamStakingProcessorRoundPayout } from './round-payout'
import { MoonbeamStakingProcessorDatabaseHelper } from './helpers/database'
import { Logger } from 'pino'
import { SliMetrics } from '@/loaders/sli_metrics'

@Service()
export class MoonbeamStakingProcessorService {

  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('knex') private readonly knex: Knex,
    @Inject('polkadotApi') private readonly polkadotApi: ApiPromise,
    @Inject('sliMetrics') private readonly sliMetrics: SliMetrics,
    private readonly databaseHelper: MoonbeamStakingProcessorDatabaseHelper,
    private readonly tasksRepository: TasksRepository,
  ) { }

  async processTaskMessage<T extends QUEUES.Staking>(message: TaskMessage<T>): Promise<void> {
    const { entity_id: roundId, collect_uid } = message

    logger.info({
      event: 'ParachainStakingProcessor.processTaskMessage',
      roundId,
      message: 'New process round task received',
      collect_uid,
    })

    const metadata = {
      block_process_uid: v4(),
      processing_timestamp: new Date(),
    }

    await this.tasksRepository.increaseAttempts(ENTITY.ROUND, roundId)

    await this.knex.transaction(async (trx: Knex.Transaction) => {
      // try {
      const taskRecord = await this.tasksRepository.readTaskAndLockRow(ENTITY.ROUND, roundId, trx)

      if (!taskRecord) {
        logger.warn({
          event: 'StakingProcessor.processTaskMessage.tx',
          roundId,
          error: 'Task record not found. Skip processing.',
          collect_uid,
        })
        return
      }

      if (taskRecord.collect_uid !== collect_uid) {
        logger.warn({
          event: 'StakingProcessor.processTaskMessage.tx',
          roundId,
          error: `Possible round ${roundId} processing task duplication. `
            + `Expected ${collect_uid}, found ${taskRecord.collect_uid}. Skip processing.`,
          collect_uid,
        })
        return
      }

      if (taskRecord.status !== PROCESSING_STATUS.NOT_PROCESSED) {
        logger.warn({
          event: 'StakingProcessor.processTaskMessage.tx',
          roundId,
          message: `Round ${roundId} has been already processed. Skip processing.`,
          collect_uid,
        })
        return
      }

      // all is good, start processing round payout
      logger.info({
        event: 'StakingProcessor.processTaskMessage.tx',
        roundId,
        message: `Start processing payout for round ${roundId}`,
        ...metadata,
        collect_uid,
      })

      await this.processRoundPayout(
        trx,
        taskRecord.data.payout_block_id,
      )

      await this.tasksRepository.setTaskRecordAsProcessed(taskRecord, trx)

      logger.info({
        event: 'StakingProcessor.processTaskMessage.tx',
        roundId,
        message: `Round ${roundId} data created, commit transaction data`,
        ...metadata,
        collect_uid,
      })

      await trx.commit()

      logger.info({
        event: 'StakingProcessor.processTaskMessage.tx',
        roundId,
        message: `Round ${roundId} tx has been committed`,
        ...metadata,
        collect_uid,
      })
    }).catch((error: Error) => {
      logger.error({
        event: 'StakingProcessor.processTaskMessage.tx',
        roundId,
        error: error.message,
        data: {
          ...metadata,
          collect_uid,
        },
      })
      throw error
    })
  }

  async processRoundPayout(
    trx: Knex.Transaction,
    payoutBlockId: number,
  ): Promise<void> {
    logger.info({
      event: 'RoundPayoutProcessor.processRoundPayout',
      message: `Process staking payout for round with payout block id: ${payoutBlockId}`,
    })

    const startProcessingTime = Date.now()

    const roundPayoutProcessor = new MoonbeamStakingProcessorRoundPayout(this.polkadotApi)

    try {
      const { round } = await roundPayoutProcessor.getRewards(payoutBlockId)

      // console.log(JSON.stringify(this.stakedValue, null, 2));

      logger.info({
        event: 'RoundPayoutProcessor.processRoundPayout',
        message: 'Round processed',
        round_id: parseInt(round.id.toString(10), 10),
        payout_block_id: round.payoutBlockId,
        payout_block_time: new Date(parseInt(round.payoutBlockTime.toString(10), 10)),
        start_block_id: round.startBlockId,
        start_block_time: new Date(parseInt(round.startBlockTime.toString(10), 10)),
        total_reward: roundPayoutProcessor.totalRewardedAmount.toString(10),
        total_stake: round.totalStaked.toString(),
        total_reward_points: parseInt(round.totalPoints.toString(), 10),
        collators_count: Object.keys(roundPayoutProcessor.stakedValue).length,
        runtime: roundPayoutProcessor.specVersion,
      })


      await this.databaseHelper.saveRound(trx, {
        round_id: parseInt(round.id.toString(10), 10),
        payout_block_id: round.payoutBlockId,
        payout_block_time: new Date(parseInt(round.payoutBlockTime.toString(10), 10)),
        start_block_id: round.startBlockId,
        start_block_time: new Date(parseInt(round.startBlockTime.toString(10), 10)),
        total_reward: roundPayoutProcessor.totalRewardedAmount.toString(10),
        total_stake: round.totalStaked.toString(),
        total_reward_points: parseInt(round.totalPoints.toString(), 10),
        collators_count: Object.keys(roundPayoutProcessor.stakedValue).length,
        runtime: roundPayoutProcessor.specVersion,
      })

      for (const collator of Object.values(roundPayoutProcessor.stakedValue) as any) {
        let collator_stake = BigInt(0)
        for (const delegator of Object.values(collator.delegators) as any) {
          collator_stake += delegator.amount.toBigInt()
          await this.databaseHelper.saveDelegators(trx, {
            round_id: parseInt(round.id.toString(10), 10),
            account_id: delegator.id,
            collator_id: collator.id,
            amount: delegator.amount.toString(10),
            final_amount: delegator.final_amount.toString(10),
            reward: delegator.reward.toString(10),
            payout_block_id: collator.payoutBlockId ? parseInt(collator.payoutBlockId, 10) : undefined,
            payout_block_time: collator.payoutBlockTime ? new Date(collator.payoutBlockTime) : undefined,
          })
        }

        await this.databaseHelper.saveCollators(trx, {
          round_id: parseInt(round.id.toString(10), 10),
          account_id: collator.id,
          total_stake: collator.bond.toBigInt() + collator_stake,
          final_stake: collator.total.toBigInt(),
          own_stake: collator.bond.toBigInt(),
          delegators_count: Object.keys(collator.delegators).length,
          total_reward_points: parseInt(collator.points.toString(10), 10),
          total_reward: collator.rewardTotal && collator.rewardTotal ? collator.rewardTotal.toString(10) : '0',
          collator_reward: collator.rewardCollator && collator.rewardCollator ? collator.rewardCollator.toString(10) : '0',
          payout_block_id: collator.payoutBlockId ? parseInt(collator.payoutBlockId, 10) : undefined,
          payout_block_time: collator.payoutBlockTime ? new Date(collator.payoutBlockTime) : undefined,
        })
      }


      logger.info({
        event: `Round ${round.id.toString(10)} staking processing finished in ${(Date.now() - startProcessingTime) / 1000} seconds.`,
      })

      await this.sliMetrics.add(
        { entity: 'staking', entity_id: round.id.toNumber(), name: 'process_time_ms', value: Date.now() - startProcessingTime })
      await this.sliMetrics.add(
        { entity: 'staking', entity_id: round.id.toNumber(), name: 'delay_time_ms', value: Date.now() - round.payoutBlockTime.toNumber() })

      const memorySize = Math.ceil(process.memoryUsage().heapUsed / (1024 * 1024))
      await this.sliMetrics.add({ entity: 'staking', entity_id: round.id.toNumber(), name: 'memory_usage_mb', value: memorySize })

    } catch (error: any) {
      console.error(error)
      logger.warn({
        event: 'RoundPayoutProcessor.processRoundPayout',
        error: `error in processing round staking: ${error.message}`,
      })
      throw error
    }
  }
}

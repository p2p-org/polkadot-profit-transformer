import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { TasksRepository } from '@/libs/tasks.repository'
import { Logger } from 'pino'
import { BlockModel } from '@/models/block.model'
import { decodeAccountBalanceValue, AccountBalance } from './helpers/crypt'
import { BalancesModel } from '@/models/balances.model'
import { BalancesDatabaseHelper } from './helpers/database'
import { ApiPromise } from '@polkadot/api'
import { environment } from '@/environment'
import { QUEUES, Rabbit, TaskMessage } from '@/loaders/rabbitmq'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@/models/processing_task.model'

@Service()
export class BalancesProcessorService {

  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('knex') private readonly knex: Knex,
    @Inject('polkadotApi') private readonly polkadotApi: ApiPromise,
    private readonly databaseHelper: BalancesDatabaseHelper,
    private readonly tasksRepository: TasksRepository,
  ) { }


  public async processTaskMessage<T extends QUEUES.Balances>(message: TaskMessage<T>): Promise<void> {
    const { entity_id: blockId, collect_uid } = message

    await this.tasksRepository.increaseAttempts(ENTITY.BLOCK_BALANCE, blockId)

    await this.knex.transaction(async (trx) => {
      const taskRecord = await this.tasksRepository.readTaskAndLockRow(ENTITY.BLOCK_BALANCE, blockId, trx)

      if (!taskRecord) {
        await trx.rollback()
        this.logger.warn({
          event: 'BalanceProcessor.processTaskMessage',
          blockId,
          warning: 'Task record not found. Skip processing',
          collect_uid,
        })
        return
      }

      if (taskRecord.attempts > environment.MAX_ATTEMPTS) {
        await trx.rollback()
        this.logger.warn({
          event: 'BalanceProcessor.processTaskMessage',
          blockId,
          warning: `Max attempts on block ${blockId} reached, cancel processing.`,
          collect_uid,
        })
        return
      }

      if (taskRecord.collect_uid !== collect_uid) {
        await trx.rollback()
        this.logger.warn({
          event: 'BalanceProcessor.processTaskMessage',
          blockId,
          warning: `Possible block ${blockId} processing task duplication. `
            + `Expected ${collect_uid}, found ${taskRecord.collect_uid}. Skip processing.`,
          collect_uid,
        })
        return
      }

      if (taskRecord.status !== PROCESSING_STATUS.NOT_PROCESSED) {
        await trx.rollback()
        this.logger.warn({
          event: 'BalanceProcessor.processTaskMessage',
          blockId,
          warning: `Block  ${blockId} has been already processed. Skip processing.`,
          collect_uid,
        })
        return
      }

      // all is good, start processing
      this.logger.info({
        event: 'BalanceProcessor.processTaskMessage',
        blockId,
        message: `Start processing block ${blockId}`,
        collect_uid,
      })

      //console.log('Start block processing', Date.now())
      const newStakingProcessingTasks = await this.processBlock(blockId, trx)
      //console.log('End block processing', Date.now())

      await this.tasksRepository.setTaskRecordAsProcessed(taskRecord, trx)

      //console.log('Set task record as processed', Date.now())
      await trx.commit()
      //console.log('Record commiter', Date.now())

      this.logger.info({
        event: 'BalanceProcessor.processTaskMessage',
        blockId,
        message: `Block ${blockId} has been processed and committed`,
        collect_uid,
        newStakingProcessingTasks,
      })

    }).catch((error: Error) => {
      this.logger.error({
        event: 'BalanceProcessor.processTaskMessage',
        blockId,
        error: error.message,
        data: {
          collect_uid,
        },
      })
      throw error
    })
  }


  async processBlock(blockId: number, trx: Knex.Transaction<any, any[]>): Promise<void> {
    //console.log('Bfore get block from DB', Date.now())
    const block = await this.databaseHelper.getBlock(blockId)
    //console.log('After get block from DB', Date.now())
    if (!block) {
      throw Error(`Block with id ${blockId} not found in DB`)
    }

    if (block.block_id == 0) return
    this.logger.info({
      event: 'BalancesProcessorService.processBlock',
      message: 'Process block',
      block_id: block.block_id,
      block_hash: block.hash
    })

    let result = {}
    try {
      result = await this.polkadotApi.rpc.state.traceBlock(
        block.hash,
        'state',
        '26aa394eea5630e07c48ae0c9558cef7b99d880ec681799c0cf30e8886371da9',
        'Put'
      )
    } catch (e) {
      console.error(e)
    }
    //console.log('After get block  trace from RPC', Date.now())

    const res = JSON.parse(JSON.stringify(result))
    if (res?.blockTrace?.events && res?.blockTrace?.events.length) {
      const balances: any = {}
      for (const event of res?.blockTrace?.events) {
        this.logger.info({
          event: 'BalancesProcessorService.processBlock',
          message: 'Found event',
          data: event
        })

        const value = event?.data?.stringValues?.value_encoded
        if (value) {
          const blake2_hash = event.data.stringValues.key
            .replace(/.*26aa394eea5630e07c48ae0c9558cef7b99d880ec681799c0cf30e8886371da9/g, '')

          const balance: AccountBalance = decodeAccountBalanceValue(value)

          this.logger.info({
            event: 'BalancesProcessorService.processBlock',
            message: 'Balance for account with blake2_hash key',
            block_id: block.block_id,
            blake2_hash: event.data.stringValues.key,
            free: balance.data.free
          })

          const data: BalancesModel = {
            block_id: block.block_id,
            blake2_hash,
            nonce: balance.nonce,
            consumers: balance.consumers,
            providers: balance.providers,
            sufficients: balance.sufficients,
            free: balance.data.free,
            reserved: balance.data.reserved,
            miscFrozen: balance.data.miscFrozen,
            feeFrozen: balance.data.feeFrozen
          }

          //console.log('Before save balance', Date.now())
          //await this.databaseHelper.saveBalances(data, trx)
          balances[blake2_hash] = data
          //console.log('After save balance', Date.now())
        }
      }

      //we save only last balalance of account for this block.
      for (const blake2_hash in balances) {
        await this.databaseHelper.saveBalances(balances[blake2_hash], trx)
      }
    } else {
      this.logger.info({
        event: 'BalancesProcessorService.processBlock',
        message: 'No balances events',
        block_id: block.block_id,
      })
    }
  }
}

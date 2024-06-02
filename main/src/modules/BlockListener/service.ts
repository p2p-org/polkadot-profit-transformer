import { Container, Inject, Service } from 'typedi'
import { Logger } from 'pino'
import { Knex } from 'knex'
import { v4 as uuidv4 } from 'uuid'
import { sleep } from '@/utils/sleep'
import { TasksRepository } from '@/libs/tasks.repository'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@/models/processing_task.model'
import { QUEUES, Rabbit } from '@/loaders/rabbitmq'
import { ProcessingStateModel } from '@/models/processing_status.model'
import { BlockListenerPolkadotHelper } from './helpers/polkadot'
import { BlockListenerDatabaseHelper } from './helpers/database'

import { environment } from '@/environment'

@Service()
export class BlockListenerService {
  gracefulShutdownFlag = false
  messagesBeingProcessed = false
  isPaused = false
  lastBlockId = 0

  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('knex') private readonly knex: Knex,
    private readonly polkadotHelper: BlockListenerPolkadotHelper,
    private readonly databaseHelper: BlockListenerDatabaseHelper,
    private readonly tasksRepository: TasksRepository,
  ) {}

  public async preload(): Promise<void> {
    this.logger.debug({ event: 'BlocksListener.preload' })

    if (!this.lastBlockId) {
      this.lastBlockId = await this.databaseHelper.findLastEntityId(ENTITY.BLOCK)
    }
    this.logger.info({ event: 'BlocksListener.preload', lastBlockId: this.lastBlockId })

    const lastFinalizedBlockId = await this.polkadotHelper.getFinBlockNumber()
    this.logger.info({ event: 'BlocksListener.preload', lastFinalizedBlockId })

    await this.ingestPreloadTasks({ fromBlock: this.lastBlockId + 1, toBlock: lastFinalizedBlockId })
    this.logger.info({ event: 'BlocksListener.preload ingested' })

    this.logger.info('preload done, go listening to the new blocks')
    this.polkadotHelper.subscribeFinalizedHeads((header) => this.newBlock(header.number.toNumber()))
  }

  public async preloadOneBlock(blockId: number): Promise<void> {
    this.logger.debug({ event: 'BlocksListener.preloadOneBlock', blockId })
    const task = this.createTask(blockId)
    await this.ingestOneBlockTask(task)
  }

  public pause(): void {
    this.logger.info('preloader paused')
    this.isPaused = true
  }

  public resume(): void {
    this.logger.info('preloader resumed')
    this.isPaused = false
  }

  public async restartUnprocessedTasks(entity: ENTITY): Promise<void> {
    let lastEntityId = 0
    while (true) {
      const records = await this.tasksRepository.getUnprocessedTasks(entity, lastEntityId)
      if (!records || !records.length) {
        return
      }

      for (const record of records) {
        await this.sendTaskToToRabbit(entity, record)
        lastEntityId = record.entity_id || 0
      }

      this.logger.info({
        event: 'BlocksListener.restartUnprocessedTasks',
        message: `Preloaded ${environment.BATCH_INSERT_CHUNK_SIZE} tasks to 
                rabbit queue for processing ${entity}. Last entity id: ${lastEntityId}`,
      })

      await sleep(5000)
    }
  }

  public async processMetadata(startBlockId: number, endBlockId: number): Promise<void> {
    for (let blockId = startBlockId; blockId <= endBlockId; blockId++) {
      const task: ProcessingTaskModel<ENTITY.BLOCK> = {
        entity: ENTITY.BLOCK_METADATA,
        entity_id: blockId,
        collect_uid: uuidv4(),
        status: PROCESSING_STATUS.NOT_PROCESSED,
        start_timestamp: new Date(),
        attempts: 0,
        data: {},
      }
      if (await this.tasksRepository.addProcessingTask(task)) {
        await this.sendTaskToToRabbit(ENTITY.BLOCK_METADATA, task)
      }
    }
  }

  public async restartUnprocessedBlocksMetadata(startBlockId: number, endBlockId: number): Promise<void> {
    let lastBlockId = startBlockId
    while (lastBlockId < endBlockId) {
      const records = await this.databaseHelper.getUnprocessedBlocksMetadata(lastBlockId)
      if (!records || !records.length) {
        return
      }

      for (const record of records) {
        if (record.block_id < endBlockId) {
          const task: ProcessingTaskModel<ENTITY.BLOCK> = {
            entity: ENTITY.BLOCK_METADATA,
            entity_id: record.block_id,
            collect_uid: uuidv4(),
            status: PROCESSING_STATUS.NOT_PROCESSED,
            start_timestamp: new Date(),
            attempts: 0,
            data: {},
          }
          await this.tasksRepository.addProcessingTask(task)
          await this.sendTaskToToRabbit(ENTITY.BLOCK_METADATA, task)
        }

        lastBlockId = record.block_id || 0
      }

      this.logger.info({
        event: 'BlocksListener.restartUnprocessedTasks',
        message: `Preloaded ${environment.BATCH_INSERT_CHUNK_SIZE} tasks to 
                rabbit queue for processing ${ENTITY.BLOCK_METADATA}. Last block id: ${lastBlockId}. End block id: ${endBlockId}`,
      })

      await sleep(100)
    }
  }

  public async restartUnprocessedBalances(startBlockId: number, endBlockId: number): Promise<void> {
    for (let blockId = startBlockId; blockId <= endBlockId; blockId++) {
      const task: ProcessingTaskModel<ENTITY.BLOCK> = {
        entity: ENTITY.BLOCK_BALANCE,
        entity_id: blockId,
        collect_uid: uuidv4(),
        status: PROCESSING_STATUS.NOT_PROCESSED,
        start_timestamp: new Date(),
        attempts: 0,
        data: {},
      }
      if (await this.tasksRepository.addProcessingTask(task)) {
        await this.sendTaskToToRabbit(ENTITY.BLOCK_BALANCE, task)
      }
    }
  }

  public async restartUnprocessedTask(entity: ENTITY, entityId: number): Promise<void> {
    const record = await this.tasksRepository.getUnprocessedTask(entity, entityId)
    if (!record) {
      this.logger.error({
        event: 'BlocksListener.restartUnprocessedTask',
        message: `${entity} with id ${entityId} not found`,
      })
      return
    }
    await this.sendTaskToToRabbit(entity, record)

    this.logger.info({
      event: 'BlocksListener.restartUnprocessedTask',
      message: `Send task to rabbit for processing ${entity}. Entity id: ${entityId}`,
    })
  }

  public async gracefullShutdown(): Promise<void> {
    this.gracefulShutdownFlag = true

    while (true) {
      if (!this.messagesBeingProcessed) break
      await sleep(100)
    }
  }

  private async newBlock(blockId: number): Promise<void> {
    if (this.messagesBeingProcessed || this.isPaused) return

    this.logger.info({ event: 'BlocksListener.preload newFinalizedBlock', newFinalizedBlockId: blockId })
    if (!this.lastBlockId) {
      this.lastBlockId = await this.databaseHelper.findLastEntityId(ENTITY.BLOCK)
    }

    this.logger.info({ event: 'BlocksListener.preload', lastBlockId: this.lastBlockId })
    await this.ingestPreloadTasks({ fromBlock: this.lastBlockId + 1, toBlock: blockId })
  }

  private async ingestOneBlockTask(task: ProcessingTaskModel<ENTITY.BLOCK>): Promise<void> {
    this.logger.info({ event: 'BlocksListener.ingestOneBlockTask', task })

    if (await this.tasksRepository.addProcessingTask(task)) {
      await this.sendTaskToToRabbit(ENTITY.BLOCK, {
        entity_id: task.entity_id,
        collect_uid: task.collect_uid,
      })

      this.logger.debug({
        event: 'BlockListenerService.ingestOneBlockTask',
        task: task,
      })
    } else {
      this.logger.error({
        event: 'BlockListenerService.ingestOneBlockTask',
        error: 'Blocks seems has been processed already',
      })
    }
  }

  private async ingestTasksChunk(tasks: ProcessingTaskModel<ENTITY.BLOCK>[]): Promise<void> {
    try {
      await this.knex
        .transaction(async (trx: Knex.Transaction) => {
          const updatedLastInsertRecord: ProcessingStateModel<ENTITY> = {
            entity: ENTITY.BLOCK,
            entity_id: tasks.at(-1)!.entity_id,
          }
          this.lastBlockId = updatedLastInsertRecord.entity_id
          await this.databaseHelper.updateLastTaskEntityId(updatedLastInsertRecord, trx)
          await this.tasksRepository.batchAddEntities(tasks, trx)
        })
        .then(async () => {
          for (const block of tasks) {
            const data = {
              entity_id: block.entity_id,
              collect_uid: block.collect_uid,
            }
            this.logger.info({ event: 'send data to rabbit', data })

            //we need to wait 1 sec for RPC sync (block propagation), beacuse block-processor can use different rpc-connection
            setTimeout(async () => {
              await this.sendTaskToToRabbit(ENTITY.BLOCK, data)
            }, 1000)
            this.logger.info({ event: ' data sent to rabbit', data })
          }
        })

      this.logger.debug({
        event: 'BlocksListener.ingestTasksChunk',
        message: 'blocks preloader sendToRabbitAndDb blocks',
        from: tasks[0].entity_id,
        to: tasks[tasks.length - 1].entity_id,
      })
    } catch (error: any) {
      this.logger.error({
        event: 'BlocksListener.ingestTasksChunk',
        error: error.message,
      })
    }
  }

  private async ingestPreloadTasks(args: { fromBlock: number; toBlock: number }): Promise<void> {
    const { fromBlock, toBlock } = args

    this.logger.info(`create series of block tasks from ${fromBlock} to ${toBlock}`)

    let tasks: ProcessingTaskModel<ENTITY.BLOCK>[] = []

    for (let id = fromBlock; id <= toBlock; id++) {
      if (this.gracefulShutdownFlag) {
        break
      }

      while (this.isPaused) {
        await sleep(500)
      }

      this.messagesBeingProcessed = true

      const task = this.createTask(id)
      tasks.push(task)

      if (id % environment.BATCH_INSERT_CHUNK_SIZE === 0) {
        this.logger.info({ event: `ingestTasksChunk up to ${id}` })

        // console.log({ id, messagesBeingProcessed, gracefulShutdownFlag })

        await this.ingestTasksChunk(tasks)
        tasks = []
        await sleep(500)
      }
    }

    if (tasks.length) {
      await this.ingestTasksChunk(tasks)
    }

    this.messagesBeingProcessed = false
  }

  private createTask(id: number): ProcessingTaskModel<ENTITY.BLOCK> {
    const task: ProcessingTaskModel<ENTITY.BLOCK> = {
      entity: ENTITY.BLOCK,
      entity_id: id,
      status: PROCESSING_STATUS.NOT_PROCESSED,
      collect_uid: uuidv4(),
      start_timestamp: new Date(),
      attempts: 0,
      data: {},
    }
    return task
  }

  private async sendTaskToToRabbit(entity: ENTITY, record: { collect_uid: string; entity_id: number }): Promise<void> {
    const rabbitMQ: Rabbit = Container.get('rabbitMQ')
    if (entity === ENTITY.ERA) {
      await rabbitMQ.send<QUEUES.Staking>(QUEUES.Staking, {
        entity_id: record.entity_id,
        collect_uid: record.collect_uid,
      })
    } else if (entity === ENTITY.ROUND) {
      await rabbitMQ.send<QUEUES.Staking>(QUEUES.Staking, {
        entity_id: record.entity_id,
        collect_uid: record.collect_uid,
      })
    } else if (entity === ENTITY.NOMINATION_POOLS_ERA) {
      await rabbitMQ.send<QUEUES.NominationPools>(QUEUES.NominationPools, {
        entity_id: record.entity_id,
        collect_uid: record.collect_uid,
      })
    } else if (entity === ENTITY.BLOCK) {
      await rabbitMQ.send<QUEUES.Blocks>(QUEUES.Blocks, {
        entity_id: record.entity_id,
        collect_uid: record.collect_uid,
      })
    } else if (entity === ENTITY.BLOCK_METADATA) {
      await rabbitMQ.send<QUEUES.BlocksMetadata>(QUEUES.BlocksMetadata, {
        entity_id: record.entity_id,
        collect_uid: record.collect_uid,
      })
    } else if (entity === ENTITY.BLOCK_BALANCE) {
      await rabbitMQ.send<QUEUES.Balances>(QUEUES.Balances, {
        entity_id: record.entity_id,
        collect_uid: record.collect_uid,
      })
    }
  }
}

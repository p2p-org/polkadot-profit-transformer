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

  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('knex') private readonly knex: Knex,
    private readonly polkadotHelper: BlockListenerPolkadotHelper,
    private readonly databaseHelper: BlockListenerDatabaseHelper,
    private readonly tasksRepository: TasksRepository,
  ) { }

  public async preload(): Promise<void> {
    this.logger.debug({ event: 'BlocksListener.preload' })
    const lastBlockIdInProcessingTasks = await this.databaseHelper.findLastEntityId(ENTITY.BLOCK)
    this.logger.info({ event: 'BlocksListener.preload', lastBlockIdInProcessingTasks })

    const lastFinalizedBlockId = await this.polkadotHelper.getFinBlockNumber()
    this.logger.info({ event: 'BlocksListener.preload', lastFinalizedBlockId })

    await this.ingestPreloadTasks({ fromBlock: lastBlockIdInProcessingTasks + 1, toBlock: lastFinalizedBlockId })
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
                rabbit queue for processing ${entity}. Last entity id: ${lastEntityId}`
      })

      await sleep(5000)
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
        if (record.id < endBlockId) {
          const task: ProcessingTaskModel<ENTITY.BLOCK> = {
            entity: ENTITY.BLOCK_METADATA,
            entity_id: record.id,
            collect_uid: uuidv4(),
            status: PROCESSING_STATUS.NOT_PROCESSED,
            start_timestamp: new Date(),
            attempts: 0,
            data: {},
          }
          await this.tasksRepository.addProcessingTask(task)
          await this.sendTaskToToRabbit(ENTITY.BLOCK_METADATA, task)
        }

        lastBlockId = record.id || 0
      }

      this.logger.info({
        event: 'BlocksListener.restartUnprocessedTasks',
        message: `Preloaded ${environment.BATCH_INSERT_CHUNK_SIZE} tasks to 
                rabbit queue for processing ${ENTITY.BLOCK_METADATA}. Last block id: ${lastBlockId}. End block id: ${endBlockId}`
      })

      await sleep(5000)
    }
  }

  public async restartUnprocessedTask(entity: ENTITY, entityId: number): Promise<void> {
    const record = await this.tasksRepository.getUnprocessedTask(entity, entityId)
    if (!record) {
      this.logger.error({
        event: 'BlocksListener.restartUnprocessedTask',
        message: `${entity} with id ${entityId} not found`
      })
      return
    }
    await this.sendTaskToToRabbit(entity, record)

    this.logger.info({
      event: 'BlocksListener.restartUnprocessedTask',
      message: `Send task to rabbit for processing ${entity}. Entity id: ${entityId}`
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
    this.logger.debug({ event: 'BlocksListener.preload newFinalizedBlock', newFinalizedBlockId: blockId })
    const lastBlockIdInProcessingTasks = await this.databaseHelper.findLastEntityId(ENTITY.BLOCK)
    this.logger.debug({ event: 'BlocksListener.preload', lastBlockIdInProcessingTasks })

    await this.ingestPreloadTasks({ fromBlock: lastBlockIdInProcessingTasks + 1, toBlock: blockId })
  }

  private async ingestOneBlockTask(task: ProcessingTaskModel<ENTITY.BLOCK>): Promise<void> {
    await this.tasksRepository.addProcessingTask(task)

    await this.sendTaskToToRabbit(ENTITY.BLOCK, {
      entity_id: task.entity_id,
      collect_uid: task.collect_uid,
    })

    this.logger.debug({
      event: 'blocks preloader ingestOneBlockTask',
      task: task,
    })
  }

  private async ingestTasksChunk(tasks: ProcessingTaskModel<ENTITY.BLOCK>[]): Promise<void> {
    try {
      await this.knex
        .transaction(async (trx: Knex.Transaction) => {
          await this.tasksRepository.batchAddEntities(tasks, trx)
          const updatedLastInsertRecord: ProcessingStateModel<ENTITY> = {
            entity: ENTITY.BLOCK,
            entity_id: tasks.at(-1)!.entity_id,
          }
          await this.databaseHelper.updateLastTaskEntityId(updatedLastInsertRecord, trx)
        })
        .then(async () => {
          for (const block of tasks) {
            const data = {
              entity_id: block.entity_id,
              collect_uid: block.collect_uid,
            }
            // logger.info({ event: 'send data to rabbit', data })
            await this.sendTaskToToRabbit(ENTITY.BLOCK, data)
            // logger.info({ event: ' data sent to rabbit', data })
          }
        })

      this.logger.debug({
        event: 'BlocksListener.ingestTasksChunk',
        message: 'blocks preloader sendToRabbitAndDb blocks',
        from: tasks[0].entity_id,
        to: tasks[tasks.length - 1].entity_id,
      })
      //console.log('ingestTasksChunk ingested')
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
      await sleep(500)
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

  private async sendTaskToToRabbit(entity: ENTITY, record: { collect_uid: string, entity_id: number }): Promise<void> {
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
    } else if (entity === ENTITY.BLOCK) {
      await rabbitMQ.send<QUEUES.Blocks>(QUEUES.Blocks, {
        block_id: record.entity_id,
        collect_uid: record.collect_uid,
      })
    } else if (entity === ENTITY.BLOCK_METADATA) {
      await rabbitMQ.send<QUEUES.BlocksMetadata>(QUEUES.BlocksMetadata, {
        block_id: record.entity_id,
        collect_uid: record.collect_uid,
      })
    }
  }


}

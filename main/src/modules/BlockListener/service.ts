import { Knex } from 'knex'
import { v4 as uuidv4 } from 'uuid'
import { sleep } from '@/utils/sleep'
import { PolkadotRepository } from '@/apps/common/infra/polkadotapi/polkadot.repository'
import { ProcessingTasksRepository } from '@/apps/common/infra/postgresql/processing_tasks.repository'
import { ProcessingStatusRepository } from '@/apps/common/infra/postgresql/processing_status.repository'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@/models/processing_task.model'
import { logger } from '@/loaders/logger'
import { QUEUES, Rabbit } from '@/loaders/rabbitmq'
import { ProcessingStateModel } from '@/models/processing_status.model'

export type BlocksPreloader = ReturnType<typeof BlocksPreloader>

export const BlocksPreloader = (deps: {
  processingTasksRepository: ProcessingTasksRepository
  processingStatusRepository: ProcessingStatusRepository
  polkadotRepository: PolkadotRepository
  rabbitMQ: Rabbit
  knex: Knex
}) => {
  const { processingTasksRepository, processingStatusRepository, polkadotRepository, rabbitMQ, knex } = deps

  let gracefulShutdownFlag = false
  let messagesBeingProcessed = false
  let isPaused = false
  const currentBlock = 0

  const createTask = (id: number): ProcessingTaskModel<ENTITY.BLOCK> => {
    const task: ProcessingTaskModel<ENTITY.BLOCK> = {
      entity: ENTITY.BLOCK,
      entity_id: id,
      status: PROCESSING_STATUS.NOT_PROCESSED,
      collect_uid: uuidv4(),
      start_timestamp: new Date(),
      attempts: 0,
      data: {},
    }
    // logger.debug({ event: 'createTask', task })
    return task
  }

  const ingestOneBlockTask = async (task: ProcessingTaskModel<ENTITY.BLOCK>) => {
    await processingTasksRepository.addProcessingTask(task)

    await sendTaskToToRabbit(ENTITY.BLOCK, {
      entity_id: task.entity_id,
      collect_uid: task.collect_uid,
    });

    logger.debug({
      event: 'blocks preloader ingestOneBlockTask',
      task: task,
    })
  }

  const ingestTasksChunk = async (tasks: ProcessingTaskModel<ENTITY.BLOCK>[]) => {
    //console.log('ingestTasksChunk')
    try {
      await knex
        .transaction(async (trx) => {
          await processingTasksRepository.batchAddEntities(tasks, trx)
          const updatedLastInsertRecord: ProcessingStateModel<ENTITY> = {
            entity: ENTITY.BLOCK,
            entity_id: tasks.at(-1)!.entity_id,
          }
          await processingStatusRepository.updateLastTaskEntityId(updatedLastInsertRecord, trx)
        })
        .then(async () => {
          for (const block of tasks) {
            const data = {
              entity_id: block.entity_id,
              collect_uid: block.collect_uid,
            }
            // logger.info({ event: 'send data to rabbit', data })
            await sendTaskToToRabbit(ENTITY.BLOCK, data);
            // logger.info({ event: ' data sent to rabbit', data })
          }
        })

      logger.debug({
        event: 'BlocksPreloader.ingestTasksChunk',
        message: 'blocks preloader sendToRabbitAndDb blocks',
        from: tasks[0].entity_id,
        to: tasks[tasks.length - 1].entity_id,
      })
      //console.log('ingestTasksChunk ingested')
    } catch (error: any) {
      logger.error({
        event: 'BlocksPreloader.ingestTasksChunk',
        error: error.message,
      })
    }
  }

  const ingestPreloadTasks = async (args: { fromBlock: number; toBlock: number }): Promise<void> => {
    const { fromBlock, toBlock } = args

    // if (toBlock < fromBlock) throw new Error('createPreloadTasks toBlock < fromBlock')

    logger.info(`create series of block tasks from ${fromBlock} to ${toBlock}`)

    let tasks: ProcessingTaskModel<ENTITY.BLOCK>[] = []

    for (let id = fromBlock; id <= toBlock; id++) {
      if (gracefulShutdownFlag) {
        break
      }

      while (isPaused) {
        await sleep(500)
      }

      messagesBeingProcessed = true

      const task = createTask(id)
      tasks.push(task)

      if (id % 1000 === 0) {
        logger.info({ event: `ingestTasksChunk up to ${id}` })

        // console.log({ id, messagesBeingProcessed, gracefulShutdownFlag })

        await ingestTasksChunk(tasks)
        tasks = []
        await sleep(500)
      }
    }

    if (tasks.length) {
      await ingestTasksChunk(tasks)
      await sleep(500)
    }

    messagesBeingProcessed = false
  }

  const preload = async () => {
    logger.debug({ event: 'BlocksPreloader.preload' })
    const lastBlockIdInProcessingTasks = await processingStatusRepository.findLastEntityId(ENTITY.BLOCK)
    logger.info({ event: 'BlocksPreloader.preload', lastBlockIdInProcessingTasks })

    const lastFinalizedBlockId = await polkadotRepository.getFinBlockNumber()
    logger.info({ event: 'BlocksPreloader.preload', lastFinalizedBlockId })

    await ingestPreloadTasks({ fromBlock: lastBlockIdInProcessingTasks + 1, toBlock: lastFinalizedBlockId })
    logger.info({ event: 'BlocksPreloader.preload ingested' })

    logger.info('preload done, go listening to the new blocks')
    polkadotRepository.subscribeFinalizedHeads((header) => newBlock(header.number.toNumber()))
  }

  const preloadOneBlock = async (blockId: number) => {
    logger.debug({ event: 'BlocksPreloader.preloadOneBlock', blockId })
    const task = createTask(blockId)
    await ingestOneBlockTask(task)
  }

  const newBlock = async (blockId: number) => {
    if (messagesBeingProcessed || isPaused) return
    logger.debug({ event: 'BlocksPreloader.preload newFinalizedBlock', newFinalizedBlockId: blockId })
    const lastBlockIdInProcessingTasks = await processingStatusRepository.findLastEntityId(ENTITY.BLOCK)
    logger.debug({ event: 'BlocksPreloader.preload', lastBlockIdInProcessingTasks })

    await ingestPreloadTasks({ fromBlock: lastBlockIdInProcessingTasks + 1, toBlock: blockId })
  }

  const gracefullShutdown = async () => {
    gracefulShutdownFlag = true

    while (true) {
      // console.log({ messagesBeingProcessed })
      if (!messagesBeingProcessed) break
      await sleep(100)
    }
  }

  const pause = () => {
    logger.info('preloader paused')
    isPaused = true
  }

  const resume = () => {
    logger.info('preloader resumed')
    isPaused = false
  }

  const restartUnprocessedTasks = async (entity: ENTITY) => {
    let lastEntityId = 0
    while (true) {
      
      const records = await processingTasksRepository.getUnprocessedTasks(entity, lastEntityId)
      if (!records || !records.length) {
        return
      }

      for (const record of records) {
        await sendTaskToToRabbit(entity, record);
        lastEntityId = record.entity_id || 0
      }

      logger.info({ 
        event: 'BlocksPreloader.restartUnprocessedTasks',
        message: `Preloaded 1000 tasks to rabbit queue for processing ${entity}. Last entity id: ${lastEntityId}`
      })
      
      await sleep(5000)
    }
  }

  const restartUnprocessedTask = async (entity: ENTITY, entityId: number) => {
    const record = await processingTasksRepository.getUnprocessedTask(entity, entityId)
    if (!record) {
      logger.error({ 
        event: 'BlocksPreloader.restartUnprocessedTask',
        message: `${entity} with id ${entityId} not found`
      })
      return
    }
    await sendTaskToToRabbit(entity, record);

    logger.info({ 
      event: 'BlocksPreloader.restartUnprocessedTask',
      message: `Send task to rabbit for processing ${entity}. Entity id: ${entityId}`
    })
  }

  const sendTaskToToRabbit = async (entity: ENTITY, record: {collect_uid: string, entity_id: number}) => {
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
    }
  }

  return {
    preload,
    preloadOneBlock,
    gracefullShutdown,
    pause,
    resume,
    restartUnprocessedTasks,
    restartUnprocessedTask,
  }
}

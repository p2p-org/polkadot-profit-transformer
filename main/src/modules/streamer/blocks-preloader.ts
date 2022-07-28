import { sleep } from './../../apps/main/index'
import { v4 } from 'uuid'

import { PolkadotRepository } from '../../apps/common/infra/polkadotapi/polkadot.repository'
import { ProcessingTasksRepository } from '@apps/common/infra/postgresql/processing_tasks.repository'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@apps/common/infra/postgresql/models/processing_task.model'
import { logger } from '@apps/common/infra/logger/logger'
import { QUEUES, Rabbit } from '@apps/common/infra/rabbitmq'
import { Knex } from 'knex'

export type BlocksPreloader = ReturnType<typeof BlocksPreloader>

export const BlocksPreloader = (deps: {
  processingTasksRepository: ProcessingTasksRepository
  polkadotRepository: PolkadotRepository
  rabbitMQ: Rabbit
  knex: Knex
}) => {
  const { processingTasksRepository, polkadotRepository, rabbitMQ, knex } = deps

  let gracefulShutdownFlag = false
  let messagesBeingProcessed = false

  const createTask = (id: number): ProcessingTaskModel<ENTITY.BLOCK> => {
    const task: ProcessingTaskModel<ENTITY.BLOCK> = {
      entity: ENTITY.BLOCK,
      entity_id: id,
      status: PROCESSING_STATUS.NOT_PROCESSED,
      collect_uid: v4(),
      start_timestamp: new Date(),
      data: {},
    }
    // logger.debug({ event: 'createTask', task })
    return task
  }

  const ingestTasksChunk = async (tasks: ProcessingTaskModel<ENTITY.BLOCK>[]) => {
    console.log('ingestTasksChunk')
    try {
      await knex.transaction(async (trx) => {
        await processingTasksRepository.batchAddEntities(tasks, trx)
        for (const block of tasks) {
          const data = {
            block_id: block.entity_id,
            collect_uid: block.collect_uid,
          }
          await rabbitMQ.send<QUEUES.Blocks>(QUEUES.Blocks, data)
          // console.log({ ack })
        }
      })

      logger.debug({
        event: 'blocks preloader sendToRabbitAndDb blocks',
        from: tasks[0].entity_id,
        to: tasks[tasks.length - 1].entity_id,
      })
      console.log('ingestTasksChunk ingested')
    } catch (error: any) {
      console.log('ingestTasksChunk error', error.message)
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

      messagesBeingProcessed = true

      const task = createTask(id)
      tasks.push(task)

      if (id % 1000 === 0) {
        logger.info({ event: `ingestTasksChunk up to ${id}` })

        // console.log({ id, messagesBeingProcessed, gracefulShutdownFlag })

        await ingestTasksChunk(tasks)
        tasks = []

        // console.log('sleep')
        await sleep(500)
        // console.log('after sleep', { id, messagesBeingProcessed, gracefulShutdownFlag })
      }
    }

    if (tasks.length) {
      await ingestTasksChunk(tasks)
      await sleep(500)
    }

    messagesBeingProcessed = false
  }

  return {
    // todo: add logic to re-collect from certain past block
    preload: async () => {
      logger.debug({ event: 'BlocksPreloader.preload' })
      const lastBlockIdInProcessingTasks = await processingTasksRepository.findLastEntityId(ENTITY.BLOCK)
      logger.debug({ event: 'BlocksPreloader.preload', lastBlockIdInProcessingTasks })

      const lastFinalizedBlockId = await polkadotRepository.getFinBlockNumber()
      logger.debug({ event: 'BlocksPreloader.preload', lastFinalizedBlockId })

      await ingestPreloadTasks({ fromBlock: lastBlockIdInProcessingTasks + 1, toBlock: lastFinalizedBlockId })
      logger.debug({ event: 'BlocksPreloader.preload ingested' })
    },
    preloadOneBlock: async (blockId: number) => {
      logger.debug({ event: 'BlocksPreloader.preloadOneBlock', blockId })
      await ingestPreloadTasks({ fromBlock: blockId, toBlock: blockId })
    },
    newBlock: async (blockId: number) => {
      if (messagesBeingProcessed) return
      logger.debug({ event: 'BlocksPreloader.preload newFinalizedBlock', newFinalizedBlockId: blockId })
      const lastBlockIdInProcessingTasks = await processingTasksRepository.findLastEntityId(ENTITY.BLOCK)
      logger.debug({ event: 'BlocksPreloader.preload', lastBlockIdInProcessingTasks })

      await ingestPreloadTasks({ fromBlock: lastBlockIdInProcessingTasks + 1, toBlock: blockId })
    },
    gracefullShutdown: async () => {
      gracefulShutdownFlag = true

      while (true) {
        // console.log({ messagesBeingProcessed })
        if (!messagesBeingProcessed) break
        await sleep(100)
      }
    },
  }
}

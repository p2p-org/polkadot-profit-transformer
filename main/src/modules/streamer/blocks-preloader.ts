import { v4 } from 'uuid'

import { PolkadotRepository } from '../../apps/common/infra/polkadotapi/polkadot.repository'
import { ProcessingTasksRepository } from '@apps/common/infra/postgresql/processing_tasks.repository'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@apps/common/infra/postgresql/models/processing_task.model'
import { logger } from '@apps/common/infra/logger/logger'
import { QUEUES, Rabbit } from '@apps/common/infra/rabbitmq'

export type BlocksPreloader = ReturnType<typeof BlocksPreloader>

export const BlocksPreloader = (deps: {
  processingTasksRepository: ProcessingTasksRepository
  polkadotRepository: PolkadotRepository
  rabbitMQ: Rabbit
}) => {
  const { processingTasksRepository, polkadotRepository, rabbitMQ } = deps

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

  const ingestPreloadTasks = async (args: {
    fromBlock: number
    toBlock: number
  }): Promise<ProcessingTaskModel<ENTITY.BLOCK>[]> => {
    const { fromBlock, toBlock } = args

    if (toBlock < fromBlock) throw new Error('createPreloadTasks toBlock < fromBlock')

    logger.debug(`create series of block tasks from ${fromBlock} to ${toBlock}`)

    let tasks: ProcessingTaskModel<ENTITY.BLOCK>[] = []

    for (let id = fromBlock; id <= toBlock; id++) {
      const task = createTask(id)
      tasks.push(task)

      if (id % 10000 === 0) {
        logger.debug(id)
        await ingestTasksChunk(tasks)
        tasks = []
      }
    }

    await ingestTasksChunk(tasks)

    return tasks
  }

  const sendToRabbit = async (tasks: ProcessingTaskModel<ENTITY.BLOCK>[]) => {
    for (const block of tasks) {
      const data = {
        block_id: block.entity_id,
        collect_uid: block.collect_uid,
      }
      await rabbitMQ.send<QUEUES.Blocks>(QUEUES.Blocks, data)
    }
    logger.debug({ event: 'blocks preloader sendToRabbit blocks', from: tasks[0].entity_id, to: tasks.at(-1)?.entity_id })
  }

  const ingestTasksChunk = async (tasks: ProcessingTaskModel<ENTITY.BLOCK>[]) => {
    await processingTasksRepository.batchAddEntities(tasks)
    await sendToRabbit(tasks)
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
      logger.debug({ event: 'BlocksPreloader.preload', newFinalizedBlockId: blockId })
      const lastBlockIdInProcessingTasks = await processingTasksRepository.findLastEntityId(ENTITY.BLOCK)
      logger.debug({ event: 'BlocksPreloader.preload', lastBlockIdInProcessingTasks })

      await ingestPreloadTasks({ fromBlock: lastBlockIdInProcessingTasks + 1, toBlock: blockId })
    },
  }
}

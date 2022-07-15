import { v4 } from 'uuid'

import { QUEUES, Rabbit, TaskMessage } from './../../apps/common/infra/rabbitmq/index'
import { StreamerRepository } from '../../apps/common/infra/postgresql/streamer.repository'
import { ExtrinsicsProcessor, ExtrinsicsProcessorInput } from './extrinsics-processor'
import { BlockModel } from 'apps/common/infra/postgresql/models/block.model'
import { processEvents } from './events-processor'
import { PolkadotRepository } from '../../apps/common/infra/polkadotapi/polkadot.repository'
import { counter } from '@apps/common/infra/prometheus'
import { logger } from '@apps/common/infra/logger/logger'
import { Knex } from 'knex'
import { ProcessingTasksRepository } from '@apps/common/infra/postgresql/processing_tasks.repository'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@apps/common/infra/postgresql/models/processing_task.model'

export type BlockProcessor = ReturnType<typeof BlockProcessor>

export const BlockProcessor = (deps: {
  polkadotRepository: PolkadotRepository
  streamerRepository: StreamerRepository
  processingTasksRepository: ProcessingTasksRepository
  rabbitMQ: Rabbit
  knex: Knex
}) => {
  const { polkadotRepository, streamerRepository, rabbitMQ, knex, processingTasksRepository } = deps
  logger.info('BlockProcessor initialized')

  const extrinsicsProcessor = ExtrinsicsProcessor({ polkadotRepository })

  const onNewBlock = async (
    metadata: any,
    blockId: number,
    trx: Knex.Transaction<any, any[]>,
  ): Promise<ProcessingTaskModel<ENTITY.BLOCK>[]> => {
    const newProcessingTasks: ProcessingTaskModel<ENTITY.BLOCK>[] = []
    const blockHash = await polkadotRepository.getBlockHashByHeight(blockId)

    logger.info('BlockProcessor: start processing block with id: ' + blockId)

    const [signedBlock, extHeader, blockTime, events] = await polkadotRepository.getInfoToProcessBlock(blockHash, blockId)

    // const current_era = parseInt(blockCurrentEra.toString(), 10)
    // const eraId = activeEra || current_era

    const extrinsicsData: ExtrinsicsProcessorInput = {
      // eraId,
      // sessionId: sessionId.toNumber(),
      blockNumber: signedBlock.block.header.number,
      events,
      extrinsics: signedBlock.block.extrinsics,
    }
    const extractedExtrinsics = await extrinsicsProcessor(extrinsicsData)

    const processedEvents = processEvents(signedBlock.block.header.number.toNumber(), events)

    // const lastDigestLogEntryIndex = signedBlock.block.header.digest.logs.length - 1

    const block: BlockModel = {
      id: signedBlock.block.header.number.toNumber(),
      hash: signedBlock.block.header.hash.toHex(),
      author: extHeader?.author ? extHeader.author.toString() : '',
      // session_id: sessionId.toNumber(),
      // current_era,
      // era: eraId,
      state_root: signedBlock.block.header.stateRoot.toHex(),
      extrinsics_root: signedBlock.block.header.extrinsicsRoot.toHex(),
      parent_hash: signedBlock.block.header.parentHash.toHex(),
      // last_log: lastDigestLogEntryIndex > -1 ? signedBlock.block.header.digest.logs[lastDigestLogEntryIndex].type : '',
      digest: signedBlock.block.header.digest.toString(),
      block_time: new Date(blockTime.toNumber()),
    }

    // save extrinsics events and block to main tables
    for (const extrinsic of extractedExtrinsics) {
      await streamerRepository(trx).extrinsics.save(extrinsic)
    }

    console.log(blockId + ': extrinsics saved')

    for (const event of processedEvents) {
      await streamerRepository(trx).events.save(event)
    }

    console.log(blockId + ': events saved')

    await streamerRepository(trx).blocks.save(block)

    console.log(blockId + ': block saved')

    for (const event of processedEvents) {
      if (event.section === 'staking' && (event.method === 'EraPayout' || event.method === 'EraPaid')) {
        logger.info({ event: 'BlockProcessor eraPayout detected', eraId: event.event.data[0] })

        const newEraStakingProcessingTask: ProcessingTaskModel<ENTITY.BLOCK> = {
          entity: ENTITY.ERA,
          entity_id: parseInt(event.event.data[0].toString()),
          status: PROCESSING_STATUS.NOT_PROCESSED,
          collect_uid: v4(),
          start_timestamp: new Date(),
          data: {
            payout_block_id: blockId,
          },
        }

        logger.debug({ event: 'newEraStakingProcessingTask', newEraStakingProcessingTask })

        newProcessingTasks.push(newEraStakingProcessingTask)
      }
    }

    counter.inc(1)
    return newProcessingTasks
  }

  // todo: refactor to more abstracted method to allow send different tasks
  // now we send only era staking task

  const sendToRabbit = async (tasks: ProcessingTaskModel<ENTITY.BLOCK>[]) => {
    for (const task of tasks) {
      logger.debug({
        event: 'blockProcessor.sendToRabbit',
        task,
      })

      const data = {
        era_id: task.entity_id,
        collect_uid: task.collect_uid,
      }
      await rabbitMQ.send<QUEUES.Staking>(QUEUES.Staking, data)
    }
    logger.debug({
      event: 'blocks preloader sendToRabbit blocks',
      from: tasks[0].entity_id,
      to: tasks[tasks.length - 1].entity_id,
    })
  }

  const processTaskMessage = async <T extends QUEUES.Blocks>(message: TaskMessage<T>) => {
    const { block_id: blockId, collect_uid } = message
    logger.info({
      event: 'new process block  task received',
      blockId,
      collect_uid,
    })

    const metadata = {
      block_process_uid: v4(),
      processing_timestamp: new Date(),
    }

    await knex.transaction(async (trx) => {
      try {
        const taskRecord = await processingTasksRepository.readTaskAndLockRow(ENTITY.BLOCK, blockId, trx)

        if (!taskRecord) {
          throw new Error('BlockProcessor task record not found. Skip processing.')
        }

        if (taskRecord.collect_uid !== collect_uid) {
          throw new Error(
            `possible block ${blockId} processing task duplication. 
Expected ${collect_uid}, found ${taskRecord.collect_uid}. Skip processing.`,
          )
        }

        if (taskRecord.status !== PROCESSING_STATUS.NOT_PROCESSED) {
          throw new Error(`Block  ${blockId} has been already processed. Skip processing.`)
        }

        // all is good, start processing
        logger.info({
          event: `Block processor start processing block ${blockId}`,
          ...metadata,
          collect_uid,
          blockId,
        })

        const newProcessingTasks = await onNewBlock(metadata, blockId, trx)

        await processingTasksRepository.batchAddEntities(newProcessingTasks)

        await processingTasksRepository.setTaskRecordAsProcessed(taskRecord, trx)

        logger.info({
          event: `block ${blockId} block data created, commit transaction data`,
          ...metadata,
          collect_uid,
        })

        await trx.commit()

        logger.info({
          event: `block ${blockId} tx has been committed`,
          ...metadata,
          collect_uid,
          newProcessingTasks,
        })

        if (!newProcessingTasks.length) return

        logger.info({
          event: `newProcessingTasks found, send to rabbit`,
          ...metadata,
          collect_uid,
        })

        await sendToRabbit(newProcessingTasks)

        logger.info({
          event: `block ${blockId} processing done`,
          ...metadata,
          collect_uid,
        })
      } catch (error: any) {
        logger.warn({
          event: error.message,
          data: {
            ...metadata,
            collect_uid,
          },
        })
        await trx.rollback()
        throw error
      }
    })
  }

  return {
    processTaskMessage,
  }
}

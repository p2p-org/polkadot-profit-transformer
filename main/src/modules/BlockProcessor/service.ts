/* eslint-disable no-restricted-syntax */
import { Knex } from 'knex'
import { v4 as uuidv4 } from 'uuid'
import { ApiPromise } from '@polkadot/api'
import { environment } from '@/environment'
import { processedBlockGauge } from '@/loaders/prometheus'
import { QUEUES, Rabbit, TaskMessage } from '@/loaders/rabbitmq'
import { BlockModel } from '@/models/block.model'
import { logger } from '@/loaders/logger'
import { ProcessingTasksRepository } from '@/apps/common/infra/postgresql/processing_tasks.repository'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@/models/processing_task.model'
import { ExtrinsicsProcessor, ExtrinsicsProcessorInput } from './extrinsics-processor'
import { processEvents } from './events-processor'
import { StreamerRepository } from './streamer.repository'
import { PolkadotRepository } from './polkadot.repository'

const MAX_ATTEMPTS = 5 // retry 5 times then skip processing

export type BlockProcessor = ReturnType<typeof BlockProcessor>;

export const BlockProcessor = (deps: {
  polkadotApi: ApiPromise
  processingTasksRepository: ProcessingTasksRepository
  rabbitMQ: Rabbit
  knex: Knex
}) => {

  const {
    polkadotApi, rabbitMQ, knex, processingTasksRepository,
  } = deps

  const polkadotRepository = PolkadotRepository({ polkadotApi })
  const streamerRepository = StreamerRepository({ knex })

  logger.info('BlockProcessor initialized')

  const extrinsicsProcessor = ExtrinsicsProcessor({ polkadotRepository })

  const onNewBlock = async (
    blockId: number,
    trx: Knex.Transaction<any, any[]>,
  ): Promise<ProcessingTaskModel<ENTITY.BLOCK>[]> => {
    const newStakingProcessingTasks: ProcessingTaskModel<ENTITY.BLOCK>[] = []
    const blockHash = await polkadotRepository.getBlockHashByHeight(blockId)

    // logger.info('BlockProcessor: start processing block with id: ' + blockId)

    const [signedBlock, extHeader, blockTime, events, metadata] = await polkadotRepository.getInfoToProcessBlock(blockHash)

    const extrinsicsData: ExtrinsicsProcessorInput = {
      // eraId: activeEra,
      // epochId: epoch,
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
      metadata,
      // era: activeEra,
      // current_era: currentEra,
      // epoch: epoch,
      state_root: signedBlock.block.header.stateRoot.toHex(),
      extrinsics_root: signedBlock.block.header.extrinsicsRoot.toHex(),
      parent_hash: signedBlock.block.header.parentHash.toHex(),
      // last_log: lastDigestLogEntryIndex > -1 ? signedBlock.block.header.digest.logs[lastDigestLogEntryIndex].type : '',
      digest: signedBlock.block.header.digest.toString(),
      block_time: new Date(blockTime.toNumber()),
    }
    if (environment.LOG_LEVEL === 'debug') console.log(block)

    // save extrinsics events and block to main tables
    for (const extrinsic of extractedExtrinsics) {
      await streamerRepository(trx).extrinsics.save(extrinsic)
    }

    // console.log(blockId + ': extrinsics saved')

    for (const event of processedEvents) {
      await streamerRepository(trx).events.save(event)
    }

    // console.log(blockId + ': events saved')

    await streamerRepository(trx).blocks.save(block)

    // console.log(blockId + ': block saved')

    for (const event of processedEvents) {
      // polkadot, kusama
      if (event.section === 'staking' && (event.method === 'EraPayout' || event.method === 'EraPaid')) {
        const newStakingProcessingTask: ProcessingTaskModel<ENTITY.BLOCK> = {
          entity: ENTITY.ERA,
          entity_id: parseInt(event.event.data[0].toString()),
          status: PROCESSING_STATUS.NOT_PROCESSED,
          collect_uid: uuidv4(),
          start_timestamp: new Date(),
          attempts: 0,
          data: {
            payout_block_id: blockId,
          },
        }
        newStakingProcessingTasks.push(newStakingProcessingTask)

        logger.debug({
          event: 'BlockProcessor.onNewBlock',
          blockId,
          message: 'detected new era',
          newStakingProcessingTask,
        })
      }

      // moonbeam, moonriver
      if (event.section === 'parachainStaking' && event.method === 'NewRound') {
        const newStakingProcessingTask: ProcessingTaskModel<ENTITY.BLOCK> = {
          entity: ENTITY.ROUND,
          entity_id: parseInt(event.event.data[1].toString()),
          status: PROCESSING_STATUS.NOT_PROCESSED,
          collect_uid: uuidv4(),
          start_timestamp: new Date(),
          attempts: 0,
          data: {
            payout_block_id: blockId,
          },
        }
        newStakingProcessingTasks.push(newStakingProcessingTask)

        logger.debug({
          event: 'BlockProcessor.onNewBlock',
          blockId,
          message: 'detected new round',
          newStakingProcessingTask,
        })
      }
    }

    return newStakingProcessingTasks
  };

  const sendStakingProcessingTasksToRabbit = async (tasks: ProcessingTaskModel<ENTITY.BLOCK>[]) => {
    for (const task of tasks) {
      logger.info({
        event: 'BlockProcessor.sendStakingProcessingTaskToRabbit',
        message: 'sendToRabbit new task for processing',
        task,
      })

      if (task.entity === ENTITY.ERA) {
        await rabbitMQ.send<QUEUES.Staking>(QUEUES.Staking, {
          entity_id: task.entity_id,
          collect_uid: task.collect_uid,
        })
      } else if (task.entity === ENTITY.ROUND) {
        await rabbitMQ.send<QUEUES.Staking>(QUEUES.Staking, {
          entity_id: task.entity_id,
          collect_uid: task.collect_uid,
        })
      }
    }
  }

  const processTaskMessage = async <T extends QUEUES.Blocks>(message: TaskMessage<T>): Promise<void> => {
    const { block_id: blockId, collect_uid } = message

    const metadata = {
      block_process_uid: uuidv4(),
      processing_timestamp: new Date(),
    }

    await processingTasksRepository.increaseAttempts(ENTITY.BLOCK, blockId)

    await knex.transaction(async (trx) => {
      const taskRecord = await processingTasksRepository.readTaskAndLockRow(ENTITY.BLOCK, blockId, trx)

      if (!taskRecord) {
        await trx.rollback()
        logger.warn({
          event: 'BlockProcessor.processTaskMessage',
          blockId,
          warning: 'Task record not found. Skip processing',
          collect_uid,
        })
        return;
      }

      if (taskRecord.attempts > MAX_ATTEMPTS) {
        await trx.rollback()
        logger.warn({
          event: 'BlockProcessor.processTaskMessage',
          blockId,
          warning: `Max attempts on block ${blockId} reached, cancel processing.`,
          collect_uid,
        })
        return;
      }

      if (taskRecord.collect_uid !== collect_uid) {
        await trx.rollback()
        logger.warn({
          event: 'BlockProcessor.processTaskMessage',
          blockId,
          warning: `Possible block ${blockId} processing task duplication. `
            + `Expected ${collect_uid}, found ${taskRecord.collect_uid}. Skip processing.`,
          collect_uid,
        })
        return;
      }

      if (taskRecord.status !== PROCESSING_STATUS.NOT_PROCESSED) {
        await trx.rollback()
        logger.warn({
          event: 'BlockProcessor.processTaskMessage',
          blockId,
          warning: `Block  ${blockId} has been already processed. Skip processing.`,
          collect_uid,
        })
        return;
      }

      // all is good, start processing
      logger.info({
        event: 'BlockProcessor.processTaskMessage',
        blockId,
        message: `Start processing block ${blockId}`,
        ...metadata,
        collect_uid,
      })

      const newStakingProcessingTasks = await onNewBlock(blockId, trx)

      if (newStakingProcessingTasks.length) {
        await processingTasksRepository.batchAddEntities(newStakingProcessingTasks, trx)
      }

      await processingTasksRepository.setTaskRecordAsProcessed(taskRecord, trx)

      /*
      logger.info({
        event: 'BlockProcessor.processTaskMessage',
        message: `Block ${blockId} block data created, commit transaction data`,
        ...metadata,
        collect_uid,
      })
      */

      await trx.commit()

      logger.info({
        event: 'BlockProcessor.processTaskMessage',
        blockId,
        message: `Block ${blockId} has been processed and committed`,
        ...metadata,
        collect_uid,
        newStakingProcessingTasks,
      })

      processedBlockGauge.set(blockId)
      if (!newStakingProcessingTasks.length) return

      logger.info({
        event: 'BlockProcessor.processTaskMessage',
        blockId,
        message: 'newProcessingTasks found, send to rabbit',
        ...metadata,
        collect_uid,
      })

      await sendStakingProcessingTasksToRabbit(newStakingProcessingTasks)

      logger.info({
        event: 'BlockProcessor.processTaskMessage',
        blockId,
        message: `block ${blockId} processing done`,
        ...metadata,
        collect_uid,
      })
    }).catch((error: Error) => {
      logger.error({
        event: 'BlockProcessor.processTaskMessage',
        blockId,
        error: error.message,
        data: {
          ...metadata,
          collect_uid,
        },
      })
      throw error
    })
  };

  return {
    processTaskMessage,
  }
};

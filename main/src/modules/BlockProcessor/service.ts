import { Container, Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { v4 as uuidv4 } from 'uuid'
import { environment } from '@/environment'
import { processedBlockGauge } from '@/loaders/prometheus'
import { QUEUES, Rabbit, TaskMessage } from '@/loaders/rabbitmq'
import { BlockModel } from '@/models/block.model'
import { TasksRepository } from '@/libs/tasks.repository'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@/models/processing_task.model'
import { BlockProcessorPolkadotHelper } from './helpers/polkadot'
import { BlockProcessorDatabaseHelper } from './helpers/database'
import { Logger } from 'pino'
import { EventModel } from '@/models/event.model'
import { ExtrinsicModel } from '@/models/extrinsic.model'
import { Compact, GenericExtrinsic, Vec } from '@polkadot/types'
import { BlockNumber, EventRecord, Call } from '@polkadot/types/interfaces'
import { AnyTuple } from '@polkadot/types/types'
import { ExtrinsicsProcessorInput } from './interfaces'
import { SliMetrics } from '@/loaders/sli_metrics'
import { IdentityDatabaseHelper } from '../IdentityProcessor/helpers/database'

@Service()
export class BlocksProcessorService {
  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('knex') private readonly knex: Knex,
    @Inject('sliMetrics') private readonly sliMetrics: SliMetrics,

    private readonly polkadotHelper: BlockProcessorPolkadotHelper,
    private readonly databaseHelper: BlockProcessorDatabaseHelper,
    private readonly identityDatabaseHelper: IdentityDatabaseHelper,
    private readonly tasksRepository: TasksRepository,
  ) { }

  async processTaskMessage(
    trx: Knex.Transaction,
    taskRecord: ProcessingTaskModel<ENTITY>,
  ): Promise<{ status: boolean; callback?: any }> {
    const { entity_id: blockId, collect_uid } = taskRecord

    //check that block wasn't processed already
    if (await this.databaseHelper.getBlockById(blockId)) {
      this.logger.info({
        event: 'BlockProcessor.processTaskMessage',
        blockId,
        message: `Block ${blockId} already present in the database`,
      })

      return { status: true }
    }

    this.logger.info({
      event: 'BlockProcessor.processTaskMessage',
      blockId,
      message: `Start processing block ${blockId}`,
    })

    const newTasks = await this.processBlock(blockId, trx)

    const callback = async () => {
      if (newTasks.length) {
        this.logger.info({
          event: 'BlockProcessor.processTaskMessage',
          blockId,
          message: `Call back called for block with ID: ${blockId}`,
        })

        await this.knex.transaction(async (trx2: Knex.Transaction) => {
          await this.tasksRepository.batchAddEntities(newTasks, trx2)
          await trx2.commit()
          await this.sendProcessingTasksToRabbit(newTasks)
        })
      }
    }

    this.logger.info({
      event: 'BlockProcessor.processTaskMessage',
      blockId,
      message: `Block processing done ${blockId}`,
    })

    return { status: true, callback }
  }

  private async sendProcessingTasksToRabbit(tasks: ProcessingTaskModel<ENTITY.BLOCK>[]): Promise<void> {
    const rabbitMQ: Rabbit = Container.get('rabbitMQ')

    for (const task of tasks) {
      this.logger.info({
        event: 'BlockProcessor.sendProcessingTasksToRabbit',
        message: 'sendToRabbit new task for processing',
        task,
      })

      if (task.entity === ENTITY.ERA) {
        await rabbitMQ.send<QUEUES.Staking>(QUEUES.Staking, {
          entity_id: task.entity_id,
          collect_uid: task.collect_uid,
        })
      } else if (task.entity === ENTITY.NOMINATION_POOLS_ERA) {
        await rabbitMQ.send<QUEUES.NominationPools>(QUEUES.NominationPools, {
          entity_id: task.entity_id,
          collect_uid: task.collect_uid,
        })
      } else if (task.entity === ENTITY.ROUND) {
        await rabbitMQ.send<QUEUES.Staking>(QUEUES.Staking, {
          entity_id: task.entity_id,
          collect_uid: task.collect_uid,
        })
      } else if (task.entity === ENTITY.BLOCK_BALANCE) {
        await rabbitMQ.send<QUEUES.Balances>(QUEUES.Balances, {
          entity_id: task.entity_id,
          collect_uid: task.collect_uid,
        })
      }
    }
  }

  private async processBlock(blockId: number, trx: Knex.Transaction<any, any[]>): Promise<ProcessingTaskModel<ENTITY.BLOCK>[]> {
    const newTasks: ProcessingTaskModel<ENTITY.BLOCK>[] = []
    const blockHash = await this.polkadotHelper.getBlockHashByHeight(blockId)

    // logger.info('BlockProcessor: start processing block with id: ' + blockId)
    const startProcessingTime = Date.now()

    const [signedBlock, extHeader, blockTime, events, metadata, totalIssuance] = await this.polkadotHelper.getInfoToProcessBlock(
      blockHash,
    )

    const extrinsicsData: ExtrinsicsProcessorInput = {
      // eraId: activeEra,
      // epochId: epoch,
      blockNumber: signedBlock.block.header.number,
      events,
      extrinsics: signedBlock.block.extrinsics,
    }
    const extractedExtrinsics = await this.processExtrinsics(extrinsicsData)

    const processedEvents = this.processEvents(signedBlock.block.header.number.toNumber(), events)

    // const lastDigestLogEntryIndex = signedBlock.block.header.digest.logs.length - 1

    const block: BlockModel = {
      block_id: signedBlock.block.header.number.toNumber(),
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
      await this.databaseHelper.saveExtrinsics(trx, extrinsic)

      if (extrinsic.signer) {
        this.logger.debug({
          event: 'BlockProcessor.onNewBlock',
          blockId,
          message: 'Trying to add new account_id to accounts table',
          data: {
            account_id: String(extrinsic.signer),
            created_at_block_id: extrinsic.block_id,
          },
        })
        // add this signer to the accounts table
        await this.identityDatabaseHelper.saveAccount({
          account_id: String(extrinsic.signer),
          created_at_block_id: extrinsic.block_id,
        })
      }
    }

    // console.log(blockId + ': extrinsics saved')
    for (const event of processedEvents) {
      await this.databaseHelper.saveEvent(trx, event)
    }

    // console.log(blockId + ': events saved')

    await this.databaseHelper.saveBlock(trx, block)

    await this.databaseHelper.saveTotalIssuance(trx, block.block_id, totalIssuance.toString(10))

    await this.sliMetrics.add({
      entity: 'block',
      entity_id: blockId,
      name: 'process_time_ms',
      value: Date.now() - startProcessingTime,
    })
    await this.sliMetrics.add({
      entity: 'block',
      entity_id: blockId,
      name: 'delay_time_ms',
      value: Date.now() - blockTime.toNumber(),
    })

    const memorySize = Math.ceil(process.memoryUsage().heapUsed / (1024 * 1024))
    await this.sliMetrics.add({ entity: 'block', entity_id: blockId, name: 'memory_usage_mb', value: memorySize })

    if (
      environment.NETWORK === 'polkadot' ||
      environment.NETWORK === 'kusama' ||
      environment.NETWORK === 'moonbeam' ||
      environment.NETWORK === 'moonriver'
    ) {
      const newBalancesProcessingTask: ProcessingTaskModel<ENTITY.BLOCK> = {
        entity: ENTITY.BLOCK_BALANCE,
        entity_id: blockId,
        status: PROCESSING_STATUS.NOT_PROCESSED,
        collect_uid: uuidv4(),
        start_timestamp: new Date(),
        attempts: 0,
        data: {},
      }
      newTasks.push(newBalancesProcessingTask)
    }

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
        newTasks.push(newStakingProcessingTask)

        if (
          environment.NETWORK === 'polkadot' ||
          environment.NETWORK === 'kusama'
        ) {
          const newNominationPoolsProcessingTask: ProcessingTaskModel<ENTITY.BLOCK> = {
            entity: ENTITY.NOMINATION_POOLS_ERA,
            entity_id: parseInt(event.event.data[0].toString()),
            status: PROCESSING_STATUS.NOT_PROCESSED,
            collect_uid: uuidv4(),
            start_timestamp: new Date(),
            attempts: 0,
            data: {
              payout_block_id: blockId,
            },
          }
          newTasks.push(newNominationPoolsProcessingTask)
        }

        this.logger.debug({
          event: 'BlockProcessor.onNewBlock',
          blockId,
          message: 'detected new era',
        })
      }

      // moonbeam, moonriver
      if (event.section === 'parachainStaking' && event.method === 'NewRound') {
        const newStakingProcessingTask: ProcessingTaskModel<ENTITY.BLOCK> = {
          entity: ENTITY.ROUND,
          entity_id: parseInt(event.event.data[1].toString()) - 2,
          status: PROCESSING_STATUS.NOT_PROCESSED,
          collect_uid: uuidv4(),
          start_timestamp: new Date(),
          attempts: 0,
          data: {
            payout_block_id: blockId,
          },
        }
        newTasks.push(newStakingProcessingTask)

        this.logger.debug({
          event: 'BlockProcessor.onNewBlock',
          blockId,
          message: 'detected new round',
          newStakingProcessingTask,
        })
      }
    }

    return newTasks
  }

  private processEvents(blockId: number, events: Vec<EventRecord>) {
    const processEvent = (acc: EventModel[], record: EventRecord, eventIndex: number): Array<EventModel> => {
      const { event } = record

      acc.push({
        event_id: `${blockId}-${eventIndex}`,
        block_id: blockId,
        section: event.section,
        method: event.method,
        // data: eventData,
        event: event,
      })

      return acc
    }
    return events.reduce(processEvent, [])
  }

  public async processExtrinsics(input: ExtrinsicsProcessorInput): Promise<ExtrinsicModel[]> {
    const { /* eraId, sessionId, */ blockNumber, events, extrinsics } = input

    const result = await Promise.all(
      extrinsics.map(async (extrinsic, index) => {
        const isSuccess = await this.polkadotHelper.isExtrinsicEventsSuccess(index, events)
        const initialCall = extrinsic.registry.createType('Call', extrinsic.method)

        const referencedEventsIds = events
          .map((event, eventIndex) => {
            const { phase } = event
            if (phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index)) {
              return `${blockNumber}-${eventIndex}`
            }
            return ''
          })
          .filter((event) => event !== '')

        if (isSuccess) {
          const extractedExtrinsics = this.polkadotHelper.recursiveExtrinsicDecoder({ call: initialCall, indexes: [], index })

          const extrinsicModels = extractedExtrinsics.map(({ call, indexes, index }) =>
            this.createExtrinsicModelFromCall(
              blockNumber,
              call,
              isSuccess,
              extrinsic,
              [...indexes, index].join('-'),
              referencedEventsIds,
            ),
          )
          return extrinsicModels
        } else {
          // failed extrinsics sometimes have currupted inner call data, skip extraction and processing of extrinscics calls
          const failedExtrinsicModel = this.createExtrinsicModelFromCall(
            blockNumber,
            initialCall,
            isSuccess,
            extrinsic,
            index.toString(),
            referencedEventsIds,
          )

          return [failedExtrinsicModel]
        }
      }),
    )

    const r = result.flat()
    // console.log(JSON.stringify(r, null, 2))
    return r
  }

  private createExtrinsicModelFromCall(
    blockNumber: Compact<BlockNumber>,
    call: Call,
    isSuccess: boolean,
    extrinsic: GenericExtrinsic<AnyTuple>,
    index: string,
    referencedEventsIds: string[],
  ): ExtrinsicModel {
    const extrinsicModel: ExtrinsicModel = {
      extrinsic_id: `${blockNumber}-${index}`,
      success: isSuccess,
      block_id: blockNumber.toNumber(),
      // session_id: sessionId,
      // era: eraId,
      section: call.section,
      method: call.method,
      mortal_period: extrinsic.era.isMortalEra ? extrinsic.era.asMortalEra.period.toNumber() : null,
      mortal_phase: extrinsic.era.isMortalEra ? extrinsic.era.asMortalEra.phase.toNumber() : null,
      is_signed: extrinsic.isSigned,
      signer: extrinsic.isSigned ? extrinsic.signer.toString() : null,
      tip: extrinsic.tip.toString(),
      nonce: extrinsic.nonce.toNumber(),
      ref_event_ids: referencedEventsIds.length > 0 ? `{${referencedEventsIds.map((value) => `"${value}"`).join(',')}}` : null,
      version: extrinsic.version,
      extrinsic: call.toHuman(),
      // args: call.args,
    }

    return extrinsicModel
  }
}

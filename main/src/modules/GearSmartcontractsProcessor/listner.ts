import { Container, Inject, Service } from 'typedi'
import { Logger } from 'pino'
import { Knex } from 'knex'
import { v4 as uuidv4 } from 'uuid'
import { sleep } from '@/utils/sleep'
import { TasksRepository } from '@/libs/tasks.repository'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@/models/processing_task.model'
import { GearSmartcontractsDatabaseHelper } from './helpers/database'
import { GearSmartcontractsProcessorService } from './processor'

import { environment } from '@/environment'
import { servicesVersion } from 'typescript'

@Service()
export class GearSmartcontractsListnerService {
  gracefulShutdownFlag = false
  messagesBeingProcessed = false
  isPaused = false

  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('knex') private readonly knex: Knex,
    private readonly processor: GearSmartcontractsProcessorService,
    private readonly databaseHelper: GearSmartcontractsDatabaseHelper,
    private readonly tasksRepository: TasksRepository,
  ) {}

  public async preload(): Promise<void> {
    this.logger.debug({ event: 'GearSmartcontractsListener.preload' })
    const lastProcessedEventId = await this.databaseHelper.findLastEntityId(ENTITY.GEAR_EVENT)
    const lastProcessedExtrinsicId = await this.databaseHelper.findLastEntityId(ENTITY.GEAR_EXTRINSIC)
    this.logger.info({
      event: 'GearSmartcontractsListener.preload',
      lastProcessedEventId,
      lastProcessedExtrinsicId,
    })

    //await this.restartUnprocessedEvents(lastProcessedEventId)
    await this.restartUnprocessedExtrinsics(lastProcessedExtrinsicId)
  }

  public async restartUnprocessedEvents(startRowId: number): Promise<void> {
    this.logger.debug({
      event: 'GearSmartcontractsListener.restartUnprocessedEvents',
    })

    let lastRowId = startRowId
    while (true) {
      //lastRowId < endRowId) {
      const events = await this.databaseHelper.getUnprocessedEvents(lastRowId)
      if (!events || !events.length) {
        break
      }

      for (const event of events) {
        //console.log('event', event)
        await this.processor.processEvent(event)

        lastRowId = event.row_id || 0
      }

      this.logger.info({
        event: 'GearSmartcontractsListner.restartUnprocessedEvents',
        message: `Last row id: ${lastRowId}`,
      })

      //tansaction here?
      //await this.databaseHelper.updateLastTaskEntityId({ entity: ENTITY.IDENTITY_EVENT, entity_id: lastRowId })

      await sleep(1000)
    }

    setTimeout(() => {
      this.restartUnprocessedEvents(lastRowId)
    }, 30 * 1000)
  }

  public async restartUnprocessedExtrinsics(startRowId: number): Promise<void> {
    this.logger.debug({
      event: 'GearSmartcontractsListener.restartUnprocessedExtrinsics',
    })
    let lastRowId = startRowId
    while (true) {
      //lastRowId < endRowId) {
      const extrinsics = await this.databaseHelper.getUnprocessedExtrinsics(lastRowId)
      if (!extrinsics || !extrinsics.length) {
        break
      }

      for (const extrinsic of extrinsics) {
        //console.log('extrinsic', extrinsic)
        await this.processor.processExtrinsic(extrinsic)

        lastRowId = extrinsic.row_id || 0
      }
      process.exit()
      this.logger.info({
        event: 'GearSmartcontractsListner.restartUnprocessedExtrinsics',
        message: `Last row id: ${lastRowId}`,
      })

      //TODO. part of extrinsics could be already updated.
      //tansaction here?
      //await this.databaseHelper.updateLastTaskEntityId({ entity: ENTITY.IDENTITY_EXTRINSIC, entity_id: lastRowId })

      await sleep(1000)
    }

    setTimeout(() => {
      this.restartUnprocessedExtrinsics(lastRowId)
    }, 30 * 1000)
  }
}

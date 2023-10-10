import { Inject, Service } from 'typedi'
import { Logger } from 'pino'
import { Knex } from 'knex'
import { sleep } from '@/utils/sleep'
import { TasksRepository } from '@/libs/tasks.repository'
import { ENTITY } from '@/models/processing_task.model'
import { IdentityDatabaseHelper } from './helpers/database'
import { IdentityProcessorService } from './processor'

@Service()
export class IdentityListnerService {
  gracefulShutdownFlag = false
  messagesBeingProcessed = false
  isPaused = false

  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('knex') private readonly knex: Knex,
    private readonly processor: IdentityProcessorService,
    private readonly databaseHelper: IdentityDatabaseHelper,
    private readonly tasksRepository: TasksRepository,
  ) {}

  public async preload(): Promise<void> {
    this.logger.debug({ event: 'IdentityListener.preload' })
    const lastProcessedEventId = await this.databaseHelper.findLastEntityId(ENTITY.IDENTITY_EVENT)
    const lastProcessedExtrinsicId = await this.databaseHelper.findLastEntityId(ENTITY.IDENTITY_EXTRINSIC)
    this.logger.info({
      event: 'IdentityListener.preload',
      lastProcessedEventId,
      lastProcessedExtrinsicId,
    })

    //TODO: remove from this module
    //we need to add signers of all extrinsics.

    //await this.databaseHelper.fixUnprocessedBlake2Accounts()
    //await this.databaseHelper.fixHexDisplay()

    try {
      await this.databaseHelper.fixUnprocessedBlake2AccountsExtrinsics()
    } catch (error: any) {
      console.error('error on IdentityListnerService.preload', error.message)
    }

    await this.restartUnprocessedExtrinsics(lastProcessedExtrinsicId)
    await this.restartUnprocessedEvents(lastProcessedEventId)
  }

  public async restartUnprocessedEvents(startRowId: number): Promise<void> {
    this.logger.debug({
      event: 'IdentityListener.restartUnprocessedEvents',
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
        event: 'IdentityListner.restartUnprocessedEvents',
        message: `Last row id: ${lastRowId}`,
      })

      //tansaction here?
      await this.databaseHelper.updateLastTaskEntityId({ entity: ENTITY.IDENTITY_EVENT, entity_id: lastRowId })

      await sleep(1000)
    }

    this.logger.info({
      event: 'IdentityListner.restartUnprocessedEvents',
      message: `Set timeout`,
    })
    setTimeout(() => {
      this.restartUnprocessedEvents(lastRowId)
    }, 30 * 1000)
  }

  public async restartUnprocessedExtrinsics(startRowId: number): Promise<void> {
    this.logger.debug({
      event: 'IdentityListener.restartUnprocessedExtrinsics',
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

      this.logger.info({
        event: 'IdentityListner.restartUnprocessedExtrinsics',
        message: `Last row id: ${lastRowId}`,
      })

      //TODO. part of extrinsics could be updated.
      //tansaction here?
      await this.databaseHelper.updateLastTaskEntityId({ entity: ENTITY.IDENTITY_EXTRINSIC, entity_id: lastRowId })

      await sleep(1000)
    }

    this.logger.info({
      event: 'IdentityListner.restartUnprocessedExtrinsics',
      message: `Set timeout`,
    })
    setTimeout(() => {
      this.restartUnprocessedExtrinsics(lastRowId)
    }, 30 * 1000)
  }
}

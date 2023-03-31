import { Inject, Service } from 'typedi'
import { Logger } from 'pino'
import { Knex } from 'knex'
import { sleep } from '@/utils/sleep'
import { ENTITY } from '@/models/processing_task.model'
import { BalancesDatabaseHelper } from './helpers/database'
import { BalancesProcessorService } from './processor'


@Service()
export class BalancesListenerService {

  gracefulShutdownFlag = false
  messagesBeingProcessed = false
  isPaused = false

  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('knex') private readonly knex: Knex,
    private readonly processor: BalancesProcessorService,
    private readonly databaseHelper: BalancesDatabaseHelper,
  ) { }

  public async preload(): Promise<void> {
    this.logger.debug({ event: 'BalancesListenerService.preload' })
    const lastProcessedBlockId = await this.databaseHelper.findLastEntityId(ENTITY.BALANCES_BLOCK)
    this.logger.info({
      event: 'BalancesListenerService.preload',
      lastProcessedBlockId,
    })

    await this.restartUnprocessedBlocks(lastProcessedBlockId)
  }

  public async restartUnprocessedBlocks(startRowId: number): Promise<void> {
    this.logger.debug({
      event: 'BalancesListenerService.restartUnprocessedBlocks',
    })
    let lastRowId = startRowId
    while (true) {
      const blocks = await this.databaseHelper.getUnprocessedBlocks(lastRowId)
      if (!blocks || !blocks.length) {
        this.logger.debug({
          event: 'BalancesListenerService.restartUnprocessedBlocks',
          message: 'All blocks were processed'
        })
        break
      }

      for (const block of blocks) {
        await this.processor.processBlock(block)
        lastRowId = block.row_id || 0
      }

      this.logger.info({
        event: 'BalancesListenerService.restartUnprocessedEvents',
        message: `Last row id: ${lastRowId}`
      })

      //tansaction here?
      await this.databaseHelper.updateLastTaskEntityId({ entity: ENTITY.BALANCES_BLOCK, entity_id: lastRowId })

      await sleep(1000)
    }

    setTimeout(() => {
      this.restartUnprocessedBlocks(lastRowId)
    }, 30 * 1000)
  }


}

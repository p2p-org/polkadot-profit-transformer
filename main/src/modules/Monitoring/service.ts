import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { TasksRepository } from '@/libs/tasks.repository'
import { MonitoringPolkadotHelper } from './helpers/polkadot'
import { MonitoringDatabaseHelper } from './helpers/database'
import { MonitoringSlackHelper } from './helpers/slack'
import { Logger } from 'pino'
import { environment } from '@/environment'
import cron from 'node-cron'
import { SliMetrics } from '@/loaders/sli_metrics'
import needle from 'needle'

@Service()
export class MonitoringService {
  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('knex') private readonly knex: Knex,
    @Inject('sliMetrics') private readonly sliMetrics: SliMetrics,
    private readonly polkadotHelper: MonitoringPolkadotHelper,
    private readonly databaseHelper: MonitoringDatabaseHelper,
    private readonly slackHelper: MonitoringSlackHelper,
    private readonly tasksRepository: TasksRepository,
  ) {
    this.cronInit()
  }

  public async cronInit(): Promise<void> {
    cron.schedule('*/5 * * * *', async () => {
      this.checkProcessingTasks()
    })
    cron.schedule('*/5 * * * *', async () => {
      this.checkBlocksSync()
    })
    cron.schedule('0 * * * *', async () => {
      this.checkMissingRounds()
    })
    cron.schedule('*/30 * * * *', async () => {
      this.checkMissingBlocks()
    })
    cron.schedule('45 0 * * *', async () => {
      this.checkDublicatesBlocks()
    })

    this.sliMetrics.add({ entity: 'system', name: `restart_${environment.MODE}`, row_time: new Date() })
    this.slackHelper.sendMessage(`Restart Last DB blockId: ${environment.MODE}: ${new Date()}`)

    /*
    console.log('restart blocks')
    if (environment.RESTART_BLOCKS_URI) {
      const res = await needle('get', environment.RESTART_BLOCKS_URI)
      console.log(res)
    }
    */
  }

  public async checkBlocksSync(): Promise<void> {
    const lastDBBlock = await this.databaseHelper.getLastBlock()
    const lastNodeBlockId = await this.polkadotHelper.getFinBlockNumber()
    if (lastDBBlock.block_id < lastNodeBlockId - 10) {
      this.slackHelper.sendMessage(
        `Sync problem. Last RPC-node blockId: ${lastNodeBlockId}. Last DB blockId: ${lastDBBlock.block_id}`,
      )

      await this.sliMetrics.add({ entity: 'block', name: 'rpc_sync_diff_count', value: lastNodeBlockId - lastDBBlock.block_id })
    }
  }

  public async checkMissingBlocks(): Promise<void> {
    const lastBlockId = await this.polkadotHelper.getFinBlockNumber()
    const missedBlocks = await this.databaseHelper.getMissedBlocks(lastBlockId)
    if (missedBlocks && missedBlocks.length) {
      this.slackHelper.sendMessage(`Detected missed blocks: ${JSON.stringify(missedBlocks)}`)

      await this.sliMetrics.add({ entity: 'block', name: 'missed_count', value: missedBlocks.length })

      this.logger.info({
        event: 'MonitoringService.checkMissingBlocks',
        message: `Need to restart blocks. ENV url is ${environment.RESTART_BLOCKS_URI}`,
      })

      try {
        if (environment.RESTART_BLOCKS_URI) {
          const res = await needle('get', environment.RESTART_BLOCKS_URI)
        }
      } catch (error: any) {
        this.logger.error({
          event: 'MonitoringService.checkMissingBlocks',
          error: error.message,
          missedBlocks,
        })
      }
    }
  }

  public async checkDublicatesBlocks(): Promise<void> {
    const dublicatesBlocks = await this.databaseHelper.getDublicatesBlocks()
    if (dublicatesBlocks && dublicatesBlocks.length) {
      this.slackHelper.sendMessage(`Detected dublicates blocks: ${JSON.stringify(dublicatesBlocks)}`)

      await this.sliMetrics.add({ entity: 'block', name: 'dublicates_count', value: dublicatesBlocks.length })
    }
  }

  public async checkMissingRounds(): Promise<void> {
    const lastDBBlock = await this.databaseHelper.getLastBlock()
    if (environment.NETWORK === 'moonbeam' || environment.NETWORK === 'moonriver') {
      const missedRounds = await this.databaseHelper.getMissedRounds(lastDBBlock.metadata.round_id)
      if (missedRounds && missedRounds.length) {
        this.slackHelper.sendMessage(`Detected missed rounds: ${JSON.stringify(missedRounds)}`)
        await this.sliMetrics.add({ entity: 'round', name: 'missed_count', value: missedRounds.length })

        this.logger.info({
          event: 'MonitoringService.checkMissingRounds',
          message: `Need to restart rounds. ENV url is ${environment.RESTART_ROUNDS_URI}`,
        })

        try {
          if (environment.RESTART_ROUNDS_URI) await needle('get', environment.RESTART_ROUNDS_URI)
        } catch (error: any) {
          this.logger.error({
            event: 'MonitoringService.checkMissingRounds',
            error: error.message,
            missedRounds,
          })
        }
      }
    } else {
      const missedEras = await this.databaseHelper.getMissedEras(lastDBBlock.metadata.era_id)
      if (missedEras && missedEras.length) {
        this.slackHelper.sendMessage(`Detected missed eras: ${JSON.stringify(missedEras)}`)
        await this.sliMetrics.add({ entity: 'era', name: 'missed_count', value: missedEras.length })

        this.logger.info({
          event: 'MonitoringService.checkMissingRounds',
          message: `Need to restart eras. ENV url is ${environment.RESTART_ERAS_URI}`,
        })

        try {
          if (environment.RESTART_ERAS_URI) await needle('get', environment.RESTART_ERAS_URI)
        } catch (error: any) {
          this.logger.error({
            event: 'MonitoringService.checkMissingRounds',
            error: error.message,
            missedEras,
          })
        }
      }
    }
  }

  public async checkProcessingTasks(): Promise<void> {
    const missedTasks = await this.databaseHelper.getMissedProcessingTasks()
    if (missedTasks && missedTasks.length) {
      this.slackHelper.sendMessage(`Detected not processed tasks: ${JSON.stringify(missedTasks)}`)

      await this.sliMetrics.add({ entity: 'queue', name: 'not_processed_count', value: missedTasks.length })
    }
  }
}

import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { TasksRepository } from '@/libs/tasks.repository'
import { MonitoringPolkadotHelper } from './helpers/polkadot'
import { MonitoringDatabaseHelper } from './helpers/database'
import { MonitoringSlackHelper } from './helpers/slack'
import { Logger } from 'pino'
import { environment } from '@/environment'
import cron from 'node-cron'

@Service()
export class MonitoringService {

  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('knex') private readonly knex: Knex,
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
    cron.schedule('30 * * * *', async () => {
      this.checkMissingBlocks()
    })
    cron.schedule('45 * * * *', async () => {
      this.checkDublicatesBlocks()
    })
  }

  public async checkBlocksSync(): Promise<void> {
    const lastDBBlock = await this.databaseHelper.getLastBlock()
    const lastNodeBlockId = await this.polkadotHelper.getFinBlockNumber()
    if (lastDBBlock.block_id < lastNodeBlockId - 10) {
      this.slackHelper.sendMessage(`Sync problem. Last RPC-node blockId: ${lastNodeBlockId}. Last DB blockId: ${lastDBBlock.block_id}`)
    }
  }

  public async checkMissingBlocks(): Promise<void> {
    const lastBlockId = await this.polkadotHelper.getFinBlockNumber()
    const missedBlocks = await this.databaseHelper.getMissedBlocks(lastBlockId)
    if (missedBlocks && missedBlocks.length) {
      this.slackHelper.sendMessage(`Detected missed blocks: ${JSON.stringify(missedBlocks)}`)
    }
  }

  public async checkDublicatesBlocks(): Promise<void> {
    const dublicatesBlocks = await this.databaseHelper.getDublicatesBlocks()
    if (dublicatesBlocks && dublicatesBlocks.length) {
      this.slackHelper.sendMessage(`Detected dublicates blocks: ${JSON.stringify(dublicatesBlocks)}`)
    }
  }

  public async checkMissingRounds(): Promise<void> {
    const lastDBBlock = await this.databaseHelper.getLastBlock()
    if (environment.NETWORK === 'moonbeam' || environment.NETWORK === 'moonriver') {
      const missedRounds = await this.databaseHelper.getMissedRounds(lastDBBlock.metadata.round_id)
      if (missedRounds && missedRounds.length) {
        this.slackHelper.sendMessage(`Detected missed rounds: ${JSON.stringify(missedRounds)}`)
      }
    } else {
      console.log(lastDBBlock.metadata.era_id)
      const missedEras = await this.databaseHelper.getMissedEras(lastDBBlock.metadata.era_id)
      if (missedEras && missedEras.length) {
        this.slackHelper.sendMessage(`Detected missed eras: ${JSON.stringify(missedEras)}`)
      }
    }
  }

  public async checkProcessingTasks(): Promise<void> {
    const missedTasks = await this.databaseHelper.getMissedProcessingTasks()
    if (missedTasks && missedTasks.length) {
      this.slackHelper.sendMessage(`Detected not processed tasks: ${JSON.stringify(missedTasks)}`)
    }
  }

}
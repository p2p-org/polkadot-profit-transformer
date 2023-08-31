import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { environment } from '@/environment'
import { QUEUES, TaskMessage } from '@/loaders/rabbitmq'
import { TasksRepository } from '@/libs/tasks.repository'
import { Logger } from 'pino'
import { BlockModel } from '@/models/block.model'
import { TotalIssuance } from '@/models/total_issuance.model'
import { ApiPromise } from '@polkadot/api'
import { ENTITY, ProcessingTaskModel, PROCESSING_STATUS } from '@/models/processing_task.model'

@Service()
export class BlockMetadataProcessorService {
  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('knex') private readonly knex: Knex,
    private readonly tasksRepository: TasksRepository,
    @Inject('polkadotApi') private readonly polkadotApi: ApiPromise,
  ) {}

  async processTaskMessage(trx: Knex.Transaction, taskRecord: ProcessingTaskModel<ENTITY>): Promise<boolean> {
    await this.processBlock(taskRecord.entity_id, trx)

    return true
  }

  private async processBlock(blockId: number, trx: Knex.Transaction<any, any[]>): Promise<void> {
    const blockHash = await this.polkadotApi.rpc.chain.getBlockHash(blockId)

    const historicalApi = await this.polkadotApi.at(blockHash)

    const totalIssuance = await historicalApi.query.balances.totalIssuance()

    const network = { network_id: environment.NETWORK_ID }
    await TotalIssuance(this.knex)
      .transacting(trx)
      .insert({
        block_id: blockId,
        total_issuance: totalIssuance.toString(10),
        ...network,
        row_time: new Date(),
      })
  }
}

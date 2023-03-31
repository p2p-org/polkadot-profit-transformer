import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { TasksRepository } from '@/libs/tasks.repository'
import { BlockProcessorPolkadotHelper } from '@/modules/BlockProcessor/helpers/polkadot'
import { Logger } from 'pino'
import { BlockModel } from '@/models/block.model'
import { decodeAccountBalanceValue, AccountBalance } from './helpers/crypt'
import { BalancesModel } from '@/models/balances.model'
import { BalancesDatabaseHelper } from './helpers/database'
import { ApiPromise } from '@polkadot/api'

@Service()
export class BalancesProcessorService {

  constructor(
    @Inject('logger') private readonly logger: Logger,
    @Inject('knex') private readonly knex: Knex,
    @Inject('polkadotApi') private readonly polkadotApi: ApiPromise,
    private readonly databaseHelper: BalancesDatabaseHelper,
    private readonly polkadotHelper: BlockProcessorPolkadotHelper,
    private readonly tasksRepository: TasksRepository,
  ) { }

  async processBlock(block: BlockModel): Promise<void> {
    if (block.block_id == 0) return

    this.logger.info({
      event: 'BalancesProcessorService.processBlock',
      message: 'Process block',
      block_id: block.block_id,
      block_hash: block.hash
    })

    let result = {}
    try {
      result = await this.polkadotApi.rpc.state.traceBlock(
        block.hash,
        'state',
        '26aa394eea5630e07c48ae0c9558cef7b99d880ec681799c0cf30e8886371da9',
        'Put'
      )
    } catch (e) {
      console.error(e)
    }

    const res = JSON.parse(JSON.stringify(result))
    //console.log(res);
    if (res?.blockTrace?.events && res?.blockTrace?.events.length) {

      for (const event of res?.blockTrace?.events) {
        this.logger.info({
          event: 'BalancesProcessorService.processBlock',
          message: 'Found event',
          data: event
        })

        const value = event?.data?.stringValues?.value_encoded
        if (value) {
          const blake2_hash = event.data.stringValues.key
            .replace(/.*26aa394eea5630e07c48ae0c9558cef7b99d880ec681799c0cf30e8886371da9/g, '')

          const balance: AccountBalance = decodeAccountBalanceValue(value)

          this.logger.info({
            event: 'BalancesProcessorService.processBlock',
            message: 'Balance for account with blake2_hash key',
            block_id: block.block_id,
            blake2_hash: event.data.stringValues.key,
            free: balance.data.free
          })

          const data: BalancesModel = {
            block_id: block.block_id,
            blake2_hash,
            nonce: balance.nonce,
            consumers: balance.consumers,
            providers: balance.providers,
            sufficients: balance.sufficients,
            free: balance.data.free,
            reserved: balance.data.reserved,
            miscFrozen: balance.data.miscFrozen,
            feeFrozen: balance.data.feeFrozen
          }

          await this.databaseHelper.saveBalances(data)
        }
      }
    }

    //} catch (e) {
    //  console.log(e)
    //
    //  this.sdfsd2222f();
    //}
  }
}

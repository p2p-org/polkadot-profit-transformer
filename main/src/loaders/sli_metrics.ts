import { Inject, Service } from 'typedi'
import { Knex } from 'knex'
import { Logger } from 'pino'
import { environment } from '@/environment'

import { SliMetricsModel } from '@/models/sli_metrics.model'

const network = { network_id: environment.NETWORK_ID }

@Service()
export class SliMetrics {

  constructor(
    @Inject('knex') private readonly knex: Knex,
    @Inject('logger') private readonly logger: Logger,
  ) {
    this.add({ entity: 'system', name: `restart_${environment.MODE}`, row_time: new Date() })
  }

  public async add(data: SliMetricsModel): Promise<void> {
    this.logger.debug({
      event: 'SliMetrics.add',
      ...data
    })

    await SliMetricsModel(this.knex)
      .insert({ ...data, ...network })
  }
}

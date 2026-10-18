import { Container } from 'typedi'
import { NominationPoolsProcessorService } from './service'
import { QUEUES, Rabbit } from '@/loaders/rabbitmq'
import { Logger } from 'pino'
import { ENTITY } from '@/models/processing_task.model'

export default (): void => {
  const serviceInstance = Container.get(NominationPoolsProcessorService)

  const rabbitMQ: Rabbit = Container.get('rabbitMQ')
  rabbitMQ.process(QUEUES.NominationPools, ENTITY.NOMINATION_POOLS_ERA, serviceInstance)

  const logger: Logger = Container.get('logger')
  logger.info('✌️ NominationPoolsProcessor module initialized')
}

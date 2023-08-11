import { Container } from 'typedi'
import { PolkadotStakingProcessorService } from './service'
import { QUEUES, Rabbit } from '@/loaders/rabbitmq'
import { Logger } from 'pino'
import { ENTITY } from '@/models/processing_task.model'

export default (): void => {
  const serviceInstance = Container.get(PolkadotStakingProcessorService)

  const rabbitMQ: Rabbit = Container.get('rabbitMQ')
  rabbitMQ.process(QUEUES.Staking, ENTITY.ERA, serviceInstance)

  const logger: Logger = Container.get('logger')
  logger.info('✌️ PolkadotStakingProcessor module initialized')
}

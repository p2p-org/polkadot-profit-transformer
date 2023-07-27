import { Container } from 'typedi'
import { PolkadotStakingProcessorService } from './service'
import { QUEUES, Rabbit } from '@/loaders/rabbitmq'
import { Logger } from 'pino'

export default (): void => {
  const serviceInstance = Container.get(PolkadotStakingProcessorService)

  const rabbitMQ: Rabbit = Container.get('rabbitMQ')
  rabbitMQ.process(QUEUES.Staking, serviceInstance)

  const logger: Logger = Container.get('logger')
  logger.info('✌️ PolkadotStakingProcessor module initialized')
}

import { Container } from 'typedi'
import { MoonbeamStakingProcessorService } from './service'
import { QUEUES, Rabbit } from '@/loaders/rabbitmq'
import { Logger } from 'pino'

export default () => {
  const serviceInstance = Container.get(MoonbeamStakingProcessorService)

  const rabbitMQ: Rabbit = Container.get('rabbitMQ')
  rabbitMQ.process(QUEUES.Staking, serviceInstance)

  const logger: Logger = Container.get('logger')
  logger.info('✌️ MoonbeamStakingProcessor module initialized')

}
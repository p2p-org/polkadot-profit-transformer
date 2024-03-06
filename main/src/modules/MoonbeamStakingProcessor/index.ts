import { Container } from 'typedi'
import { MoonbeamStakingProcessorService } from './service'
import { QUEUES, Rabbit } from '@/loaders/rabbitmq'
import { Logger } from 'pino'
import { ENTITY } from '@/models/processing_task.model'

export default (): void => {
  const serviceInstance = Container.get(MoonbeamStakingProcessorService)

  const rabbitMQ: Rabbit = Container.get('rabbitMQ')
  rabbitMQ.process(QUEUES.Staking, ENTITY.ROUND, serviceInstance)

  const logger: Logger = Container.get('logger')
  logger.info('✌️ MoonbeamStakingProcessor module initialized!')
}

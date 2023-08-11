import { Container } from 'typedi'
import { BlocksProcessorService } from './service'
import { QUEUES, Rabbit } from '@/loaders/rabbitmq'
import { Logger } from 'pino'
import { ENTITY } from '@/models/processing_task.model'

export default (): void => {
  const serviceInstance = Container.get(BlocksProcessorService)

  const rabbitMQ: Rabbit = Container.get('rabbitMQ')
  rabbitMQ.process(QUEUES.Blocks, ENTITY.BLOCK, serviceInstance)

  const logger: Logger = Container.get('logger')
  logger.info('✌️ BlockProcessor module initialized!')
}

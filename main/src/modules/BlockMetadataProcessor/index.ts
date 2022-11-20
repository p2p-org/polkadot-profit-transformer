import { Container } from 'typedi'
import { BlockMetadataProcessorService } from './service'
import { QUEUES, Rabbit } from '@/loaders/rabbitmq'
import { Logger } from 'pino'

export default (): void => {
  const serviceInstance = Container.get(BlockMetadataProcessorService)

  console.log("----------");
  const rabbitMQ: Rabbit = Container.get('rabbitMQ')
  rabbitMQ.process(QUEUES.BlocksMetadata, serviceInstance)

  console.log("==========");
  const logger: Logger = Container.get('logger')
  logger.info('✌️ BlockMetadataProcessor module initialized')
}

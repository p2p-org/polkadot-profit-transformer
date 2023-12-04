import { Container } from 'typedi'
import { BlockMetadataProcessorService } from './service'
import { QUEUES, Rabbit } from '@/loaders/rabbitmq'
import { Logger } from 'pino'
import { ENTITY } from '@/models/processing_task.model'

export default (): void => {
  const serviceInstance = Container.get(BlockMetadataProcessorService)

  const rabbitMQ: Rabbit = Container.get('rabbitMQ')
  rabbitMQ.process(QUEUES.BlocksMetadata, ENTITY.BLOCK_METADATA, serviceInstance)

  const logger: Logger = Container.get('logger')
  logger.info('✌️ BlockMetadataProcessor module initialized')
}

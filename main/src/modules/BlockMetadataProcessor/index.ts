import { Container } from 'typedi'
import { BlockMetadataProcessorService } from './service'
//import { BlockMetadataProcessorController } from './controller'
import { QUEUES, Rabbit } from '@/loaders/rabbitmq'
import { Logger } from 'pino'

export default () => {
    const serviceInstance = Container.get(BlockMetadataProcessorService)
    //Container.get(BlockMetadataProcessorController)

    const rabbitMQ: Rabbit = Container.get('rabbitMQ')
    rabbitMQ.process(QUEUES.BlocksMetadata, serviceInstance)

    const logger: Logger = Container.get('logger')
    logger.info('✌️ BlockProcessor module initialized')
}

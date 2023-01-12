import { Container } from 'typedi'
import { BlockListenerService } from './service'
import { BlockListenerController } from './controller'
import { sleep } from '@/utils/sleep'
import { environment, NODE_ENV } from '@/environment'
import { Logger } from 'pino'

export default (): void => {

  const serviceInstance = Container.get(BlockListenerService)
  Container.get(BlockListenerController)

  process.on('SIGTERM', async () => {
    serviceInstance.gracefullShutdown()
    await sleep(10000)
    process.exit(0)
  })

  process.on('SIGINT', async () => {
    serviceInstance.gracefullShutdown()
    await sleep(10000)
    process.exit(0)
  })

  if (environment.NODE_ENV !== NODE_ENV.DEVELOPMENT) {
    serviceInstance.preload()
  }
  //await workerInstance.preloadOneBlock(1858800)

  const logger: Logger = Container.get('logger')
  logger.info('✌️ BlockListener module initialized')
}
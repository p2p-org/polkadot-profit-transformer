import { Container } from 'typedi'
import { IdentityListnerService } from './listner'
import { IdentityProcessorService } from './processor'
import { Logger } from 'pino'

export default (): void => {
  const listener = Container.get(IdentityListnerService)
  const processor = Container.get(IdentityProcessorService)

  listener.preload()

  const logger: Logger = Container.get('logger')
  logger.info('✌️ IdentityProcessor module initialized')
}

import { Container } from 'typedi'
import { GearSmartcontractsListnerService } from './listner'
import { GearSmartcontractsProcessorService } from './processor'
import { Logger } from 'pino'

export default (): void => {
  const listener = Container.get(GearSmartcontractsListnerService)
  const processor = Container.get(GearSmartcontractsProcessorService)

  listener.preload()

  const logger: Logger = Container.get('logger')
  logger.info('✌️ IdentityProcessor module initialized')
}

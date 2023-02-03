import { Container } from 'typedi'
import { BalancesProcessorService } from './processor'
import { BalancesListenerService } from './listner'
import { Logger } from 'pino'

export default (): void => {
  Container.get(BalancesProcessorService)

  const listenerInstance = Container.get(BalancesListenerService)

  listenerInstance.preload()

  const logger: Logger = Container.get('logger')
  logger.info('✌️ BalancesProcessor module initialized')
}

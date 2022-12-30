import { Container } from 'typedi'
//import { MonitoringService } from './service'
import { Logger } from 'pino'

export default (): void => {
//  Container.get(MonitoringService)

  const logger: Logger = Container.get('logger')
  logger.info('✌️ Monitoring module initialized!')
}

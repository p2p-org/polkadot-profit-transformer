import { Container } from 'typedi'
import { MoonbeamStakingProcessorRecalcService } from './service'
import { Logger } from 'pino'

export default (): void => {
  Container.get(MoonbeamStakingProcessorRecalcService)

  const logger: Logger = Container.get('logger')
  logger.info('✌️ MoonbeamStakingProcessorRecalc module initialized')

}
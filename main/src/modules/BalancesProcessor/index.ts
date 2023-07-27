import { Container } from 'typedi'
import { BalancesProcessorService } from './processor'
//import { BalancesListenerService } from './listner'
import { QUEUES, Rabbit } from '@/loaders/rabbitmq'
import { Logger } from 'pino'
//import { decodeAccountBalanceValue, AccountBalance } from './helpers/crypt'
//console.log(decodeAccountBalanceValue("01020000000000000000f94a7d020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000"));

export default (): void => {
  const serviceInstance = Container.get(BalancesProcessorService)

  const rabbitMQ: Rabbit = Container.get('rabbitMQ')
  rabbitMQ.process(QUEUES.Balances, serviceInstance)

  //  const listenerInstance = Container.get(BalancesListenerService)
  // listenerInstance.preload()

  const logger: Logger = Container.get('logger')
  logger.info('✌️ BalancesProcessor module initialized')
}

import { IIdentityProcessorService } from '../identity_processor/identity_processor.types'
import { IRunnerService } from './runner.types'
import { environment } from '../../environment'

import IdentityProcessorService from '../identity_processor/identity_processor'
import { KafkaModule } from '../../modules/kafka.module'
import { ILoggerModule, LoggerModule } from '../../modules/logger.module'

const { KAFKA_PREFIX } = environment

class RunnerService implements IRunnerService {
  private readonly identityProcessorService: IIdentityProcessorService = new IdentityProcessorService()
  private readonly kafka: KafkaModule = KafkaModule.inject()
  private readonly logger: ILoggerModule = LoggerModule.inject()

  async start(): Promise<void> {
    await this.kafka.consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const entry = JSON.parse(String(message.value))

          switch (topic) {
            case KAFKA_PREFIX + '_ENRICHMENT_ACCOUNT_DATA':
              await this.identityProcessorService.processEvent(entry)
              break
            case KAFKA_PREFIX + '_EXTRINSICS_DATA':
              await this.identityProcessorService.processExtrinsics(entry)
              break
            default:
              this.logger.error(`failed to process topic message "${topic}"`)
          }
        } catch (err) {
          this.logger.error(`cannot process topic message "${err}"`)
        }
      }
    })
  }
}

export { RunnerService }

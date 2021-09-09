import { Logger } from '../../logger/logger'
import { EventEntry, ExtrinsicsEntry } from '@modules/governance/types'
import { GovernanceProcessor } from '@modules/governance'
import { Kafka } from 'kafkajs'

import { environment } from '../../../../governance-processor-app/environment'

export const KafkaListenerFactory = (processor: GovernanceProcessor, logger: Logger) => {
  const kafka = new Kafka({
    clientId: environment.APP_ID,
    brokers: [environment.KAFKA_URI!],
  })
  const consumer = kafka.consumer({ groupId: environment.APP_ID! })

  return {
    listen: async (): Promise<void> => {
      await consumer.connect()
      await consumer.subscribe({
        topic: new RegExp(`${environment.KAFKA_PREFIX}_GOVERNANCE_DATA.*|${environment.KAFKA_PREFIX}_EXTRINSICS_DATA.*`, 'i'),
      })
      consumer.run({
        eachMessage: async ({ topic, message }) => {
          try {
            switch (topic) {
              case environment.KAFKA_PREFIX + '_GOVERNANCE_DATA':
                const eventEntry = JSON.parse(String(message.value)) as EventEntry
                await processor.processEventHandler(eventEntry)
                break
              case environment.KAFKA_PREFIX + '_EXTRINSICS_DATA':
                const extrinsicsEntry = JSON.parse(String(message.value)) as ExtrinsicsEntry
                await processor.processExtrinsicsHandler(extrinsicsEntry)
                break
              default:
                logger.error(`unknow kafka topic: "${topic}"`)
            }
          } catch (err) {
            logger.error({ err, topic, message }, `Error in kafka eachMessage`)
          }
        },
      })
    },
  }
}

import { Kafka, Consumer, Producer, RecordMetadata } from 'kafkajs'
import { environment } from '../environment'
import { IEnrichmentEntry } from '../services/identity_processor/identity_processor.types'

const { APP_CLIENT_ID, KAFKA_URI, KAFKA_PREFIX } = environment

export class KafkaModule {
  private static instance: KafkaModule
  private kafka!: Kafka
  public consumer!: Consumer
  private producer!: Producer
  private ready = false
  constructor() {
    if (!KafkaModule.instance) {
      KafkaModule.instance = this

      this.kafka = new Kafka({
        clientId: APP_CLIENT_ID,
        brokers: [KAFKA_URI]
      })

      this.producer = this.kafka.producer()
      this.consumer = this.kafka.consumer({ groupId: APP_CLIENT_ID })
    }

    return KafkaModule.instance
  }

  static async init(): Promise<void> {
    if (!KafkaModule.instance) {
      KafkaModule.instance = new KafkaModule()
      await KafkaModule.instance.producer.connect()
      await KafkaModule.instance.consumer.connect()
      await KafkaModule.instance.consumer.subscribe({
        topic: new RegExp(`${KAFKA_PREFIX}_ENRICHMENT_.*|${KAFKA_PREFIX}_EXTRINSICS_DATA.*`, 'i'),
        fromBeginning: true
      })
      KafkaModule.instance.ready = true
    }
  }

  static inject(): KafkaModule {
    if (!KafkaModule.instance.ready) {
      throw new Error(`You haven't initialized KafkaModule`)
    }

    return KafkaModule.instance
  }

  async sendEnrichmentData(key: string, data: IEnrichmentEntry): Promise<RecordMetadata[]> {
    return this.producer.send({
      topic: KAFKA_PREFIX + '_IDENTITY_ENRICHMENT_DATA',
      messages: [
        {
          key: key,
          value: JSON.stringify(data)
        }
      ]
    })
  }
}

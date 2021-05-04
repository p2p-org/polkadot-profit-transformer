import { Kafka, Producer } from 'kafkajs'
import { environment } from '../environment'

const { APP_CLIENT_ID, KAFKA_URI } = environment

export class KafkaModule {
	private static instance: KafkaModule

	private kafka: Kafka
	private producer: Producer
	private ready = false
	private constructor() {
		this.kafka = new Kafka({
			clientId: APP_CLIENT_ID,
			brokers: [KAFKA_URI]
		})
		this.producer = this.kafka.producer()
	}

	static async init(): Promise<void> {
		if (!KafkaModule.instance) {
			KafkaModule.instance = new KafkaModule()
			await KafkaModule.instance.producer.connect()
			KafkaModule.instance.ready = true
		}
	}
	static inject(): Producer {
		if (!KafkaModule.instance.ready) {
			throw new Error(`You haven't initialized KafkaModule`)
		}

		return KafkaModule.instance.producer
	}
}

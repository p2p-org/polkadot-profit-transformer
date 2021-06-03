import { Kafka, Producer } from 'kafkajs'
import { environment } from '../environment'
import { IEraData, INominator, IValidator } from '../services/staking/staking.types'
import { IExtrinsic } from '../services/extrinsics/extrinsics.types'
import { IBlockData } from '../services/blocks/blocks.types'

const { APP_CLIENT_ID, KAFKA_URI, KAFKA_PREFIX } = environment

export interface IKafkaModule {
	sendStakingErasData(eraData: IEraData): Promise<void>

	sendSessionData(
		eraId: number,
		validators: IValidator[],
		nominators: INominator[],
		blockTime: number
	): Promise<void>

	sendExtrinsicsData(
		blockNumber: string,
		extrinsics: IExtrinsic[]
	): Promise<void>

	sendBlockData(blockData: IBlockData): Promise<void>
}

export class KafkaModule implements IKafkaModule {
	private static instance: KafkaModule

	private kafka!: Kafka
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
		}
		
		return KafkaModule.instance
	}

	static async init(): Promise<void> {
		if (!KafkaModule.instance) {
			KafkaModule.instance = new KafkaModule()
			await KafkaModule.instance.producer.connect()
			KafkaModule.instance.ready = true
		}
	}
	static inject(): KafkaModule {
		if (!KafkaModule.instance.ready) {
			throw new Error(`You haven't initialized KafkaModule`)
		}

		return KafkaModule.instance
	}
	
	async sendStakingErasData(eraData: IEraData): Promise<void> {
		try {
			await this.producer.send({
				topic: KAFKA_PREFIX + '_STAKING_ERAS_DATA',
				messages: [
					{
						key: eraData.era.toString(),
						value: JSON.stringify(eraData)
					}
				]
			})
		} catch (error) {
			throw new Error('cannot push session data to Kafka')
		}
	}

	async sendSessionData(
		eraId: number,
		validators: IValidator[],
		nominators: INominator[],
		blockTime: number
	): Promise<void> {
		try {
			await this.producer.send({
				topic: KAFKA_PREFIX + '_SESSION_DATA',
				messages: [
					{
						// key: blockData.block.header.number.toString(),
						value: JSON.stringify({
							era: +eraId.toString(),
							validators: validators.map((validator) => ({ ...validator, block_time: blockTime.toNumber() })),
							nominators: nominators.map((nominator) => ({ ...nominator, block_time: blockTime.toNumber() })),
							block_time: blockTime
						})
					}
				]
			})
		} catch (error) {
			throw new Error('cannot push session data to Kafka')
		}
	}

	async sendExtrinsicsData(
		blockNumber: string,
		extrinsics: IExtrinsic[]
	): Promise<void> {
		try {
			await this.producer
				.send({
					topic: KAFKA_PREFIX + '_EXTRINSICS_DATA',
					messages: [
						{
							key: blockNumber,
							value: JSON.stringify({
								extrinsics: extrinsics
							})
						}
					]
				})
		} catch (error) {
			throw new Error('cannot push block to Kafka')
		}
	}

	async sendBlockData(blockData: IBlockData): Promise<void> {
		try {
			await this.producer.send({
				topic: KAFKA_PREFIX + '_BLOCK_DATA',
				messages: [
					{
						key: blockData.block.header.number.toString(),
						value: JSON.stringify(blockData)
					}
				]
			})
		} catch (error) {
			throw new Error('cannot push block to Kafka')
		}
	}
}

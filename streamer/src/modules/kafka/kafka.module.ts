import { Kafka, Producer } from 'kafkajs'
import { environment } from '../../environment'
import { IEraData, INominator, IValidator } from '../../services/staking/staking.types'
import { IExtrinsic } from '../../services/extrinsics/extrinsics.types'
import { IBlockData } from '../../services/blocks/blocks.types'
import { IKafkaModule } from './kafka.types'

const { APP_CLIENT_ID, KAFKA_URI, KAFKA_PREFIX } = environment

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
    }

    if (!KafkaModule.instance.ready) {
      await KafkaModule.instance.producer.connect()
      KafkaModule.instance.ready = true
    }
  }

  static inject(): KafkaModule {
    if (KafkaModule.instance && KafkaModule.instance.ready) {
      return KafkaModule.instance
    }

    throw new Error(`You haven't initialized KafkaModule`)
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

  async sendSessionData(eraId: number, validators: IValidator[], nominators: INominator[], blockTime: number): Promise<void> {
    try {
      await this.producer.send({
        topic: KAFKA_PREFIX + '_SESSION_DATA',
        messages: [
          {
            // key: blockData.block.header.number.toString(),
            value: JSON.stringify({
              era: +eraId.toString(),
              validators: validators.map((validator) => ({ ...validator, block_time: blockTime })),
              nominators: nominators.map((nominator) => ({ ...nominator, block_time: blockTime })),
              block_time: blockTime
            })
          }
        ]
      })
    } catch (error) {
      throw new Error('cannot push session data to Kafka')
    }
  }

  async sendExtrinsicsData(blockNumber: string, extrinsics: IExtrinsic[]): Promise<void> {
    // temporary disabled extralarge batch extrinsics processing
    // issue found in extrinsic https://kusama.subscan.io/extrinsic/8949171-2
    // todo - rethink extrinsics database storage

    if (JSON.stringify(extrinsics).length > 1e6) extrinsics = []
    try {
      await this.producer.send({
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

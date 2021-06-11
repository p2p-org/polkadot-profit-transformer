import { IEraData, INominator, IValidator } from '../../services/staking/staking.types'
import { IExtrinsic } from '../../services/extrinsics/extrinsics.types'
import { IBlockData } from '../../services/blocks/blocks.types'

export interface IKafkaModule {
	sendStakingErasData(eraData: IEraData): Promise<void>

	sendSessionData(eraId: number, validators: IValidator[], nominators: INominator[], blockTime: number): Promise<void>

	sendExtrinsicsData(blockNumber: string, extrinsics: IExtrinsic[]): Promise<void>

	sendBlockData(blockData: IBlockData): Promise<void>
}

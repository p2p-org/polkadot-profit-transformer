import {
	AccountId,
	BlockHash,
	EraIndex,
	Moment,
	RewardPoint,
	SessionIndex,
	ValidatorId
} from '@polkadot/types/interfaces';
import { ApiPromise } from '@polkadot/api';
import { Producer } from 'kafkajs';
import { Pool } from 'pg';
import { AnyJson } from '@polkadot/types/types';

export interface IStakingService {
	syncValidators(era: number): Promise<void>;

	extractStakers(era: TBlockEra, blockData: Pick<IBlockModel, 'id' | 'hash'>): Promise<void>;

	getValidators(
		blockHash: TBlockHash,
		sessionId: SessionIndex,
		blockTime: Moment,
		blockEra: TBlockEra
	): Promise<IGetValidatorsResult>;

	getStakersByValidator(
		blockHash: TBlockHash,
		sessionId: SessionIndex,
		blockTime: Moment,
		blockEra: TBlockEra,
		erasRewardPointsMap: Map<AccountId, RewardPoint>,
		validators: ValidatorId[],
		isEnabled: boolean
	): Promise<IGetStakersByValidator>;

	getFirstBlockFromDB(era: number, offset: number): Promise<Pick<IBlockModel, 'id' | 'hash'>>;

	getLastEraFromDB(): Promise<IBlockModel['era']>;

	updateMetaData(blockHash: TBlockHash): Promise<void>;
}

export interface IApplication {
	polkadotConnector: ApiPromise;
	kafkaProducer: Producer;
	postgresConnector: Pool;
}

export interface IBlockModel {
	id: string;
	hash: string;
	era: number;
}

export interface IGetStakersByValidator {
	validators: IValidator[];
	nominators: INominator[];
	nominators_active: number;
}
export interface IGetValidatorsResult {
	validators: IValidator[];
	stakers: IStaker[];
	era_data: IEraData;
	nominators: INominator[];
	nominators_active: number;
}

export interface IValidator {
	session_id: number;
	account_id: string;
	era: number;
	is_enabled: boolean;
	total: string;
	own: string;
	nominators_count: number;
	reward_points: string;
	reward_dest?: string;
	reward_account_id?: string;
	prefs: Record<string, AnyJson>;
	block_time: number;
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface IStaker {

}

export interface INominator {
	account_id: string;
	era: number;
	session_id: number;
	validator: string;
	is_enabled: boolean;
	is_clipped: boolean;
	value: string;
	block_time: number;
	reward_dest?: string;
	reward_account_id?: AccountId;
}

export interface IEraData {
	era: number;
	session_start: number;
	validators_active: number;
	nominators_active: number;
	total_reward: string;
	total_stake: string;
	total_reward_points: number;
}

export type TBlockHash = string | BlockHash | Uint8Array;
export type TBlockEra = number | string | EraIndex | Uint8Array;

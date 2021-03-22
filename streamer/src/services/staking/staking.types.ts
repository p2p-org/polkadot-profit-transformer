import { u32 } from '@polkadot/types';
import {
	AccountId,
	BlockHash,
	EraIndex,
	Hash,
	Moment,
	RewardPoint,
	SessionIndex,
	ValidatorId
} from '@polkadot/types/interfaces';
import { ApiPromise } from '@polkadot/api';
import { Producer } from 'kafkajs';
import { Pool } from 'pg';
import { FastifyInstance } from 'fastify';

export interface IStakingService {
	app: FastifyInstance & IApplication;
	currentSpecVersion: u32;

	syncValidators(era: number): Promise<void>;

	extractStakers(era: TBlockEra, blockData: Pick<IBlockModel, 'id' | 'hash'>): Promise<void>;

	getValidators(
		blockHash: TBlockHash,
		sessionId: SessionIndex,
		blockTime: Moment,
		blockEra: TBlockEra
	): Promise<IValidator>;

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

}

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
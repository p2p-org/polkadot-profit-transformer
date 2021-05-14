import { BlockNumber, EventRecord } from '@polkadot/types/interfaces'
import { Compact, Vec } from '@polkadot/types'
import { GenericExtrinsic } from '@polkadot/types/extrinsic/Extrinsic'

export interface IExtrinsicsService {
	extractExtrinsics(
		eraId: number,
		sessionId: number,
		blockNumber: Compact<BlockNumber>,
		events: Vec<EventRecord>,
		extrinsicsVec: Vec<GenericExtrinsic>,
	): Promise<void>
}

export interface IExtrinsic {
	id: string;
	block_id: Compact<BlockNumber>;
	parent_id?: string;
	session_id: number;
	era: number;
	section: any;
	method: any;
	mortal_period: number | null;
	mortal_phase: number | null;
	is_signed: boolean;
	signer: string | null;
	tip: number;
	nonce: number;
	ref_event_ids: string | null;
	version: number;
	extrinsic: any;
	args: any;
};

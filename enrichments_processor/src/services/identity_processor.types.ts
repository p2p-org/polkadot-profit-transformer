import {
  AccountId,
  BlockHash,
  EraIndex,
  Moment,
  RewardPoint,
  SessionIndex,
  ValidatorId,
} from '@polkadot/types/interfaces';




import { ApiPromise } from '@polkadot/api';
import { Producer } from 'kafkajs';
import { AnyJson } from '@polkadot/types/types';


export interface IApplication {
  polkadotConnector: ApiPromise;
  kafkaProducer: Producer;
}

export interface IExtrinsic {
  id: string,
  method: string,
  signer: string,
  args: any
}

export interface IExtrinsicsEntry {
  extrinsics: [IExtrinsic]
}

export interface IEvent {
  account_id: string,
  block_id: string,
  event: string,
  event_id: string

}

export interface IIdentityProcessorService {
  processEvent(event: IEvent): Promise<void>;

  onNewAccount(event: IEvent): Promise<void>;

  onKilledAccount(event: IEvent): Promise<void>;

  processExstrinsics( extrinsics: [IExtrinsic]): Promise<void>;

  updateAccountIdentity(extrinsic: IExtrinsic): Promise<void>

  updateSubAccounts(extrinsic: IExtrinsic): Promise<void>


}
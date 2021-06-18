import { ApiPromise } from '@polkadot/api'
import { Producer } from 'kafkajs'
import { Option } from '@polkadot/types'
import { Registration } from '@polkadot/types/interfaces'

export interface IApplication {
  polkadotConnector: ApiPromise
  kafkaProducer: Producer
}

export interface IExtrinsic {
  id: string
  method: string
  signer: string
  args: any
}

export interface IExtrinsicsEntry {
  extrinsics: IExtrinsic[]
}

export interface IEvent {
  account_id: string
  block_id: number
  event: string
  event_id: string
  data: string
}

export enum JudgementStatus {
  REQUESTED = 'requested',
  GIVEN = 'given',
  UNREQUESTED = 'unrequested'
}

export interface IEnrichmentEntry {
  account_id: string
  root_account_id?: string | null
  display?: string | null
  legal?: string | null
  web?: string | null
  riot?: string | null
  email?: string | null
  twitter?: string | null
  judgement_status?: JudgementStatus
  registrar_index?: number
  created_at?: number
  killed_at?: number
}

export interface ISubsEntry {
  key: string
  accountId: string
  rootAccountId: string | null
}

export interface IIdentityProcessorService {
  processEvent(event: IEvent): Promise<void>

  onNewAccount(event: IEvent): Promise<void>

  onKilledAccount(event: IEvent): Promise<void>

  processExtrinsics(entry: IExtrinsicsEntry): Promise<void>

  updateAccountIdentity(extrinsic: IExtrinsic): Promise<void>

  updateSubAccounts(extrinsic: IExtrinsic): Promise<void>

  pushEnrichment(key: string, data: IEnrichmentEntry): Promise<void>

  // getIdentity(accountId: string): Promise<Option<Registration>>
}

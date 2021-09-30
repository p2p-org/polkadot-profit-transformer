export type EventEntry = {
  block_id: number
  section: string
  method: string
  event_id: string
  data: string
}

export interface Extrinsic {
  id: string
  block_id: number
  section: string
  method: string
  signer: string
  extrinsic: any
  args: any
}

export type ExtrinsicsEntry = {
  extrinsics: Extrinsic[]
}

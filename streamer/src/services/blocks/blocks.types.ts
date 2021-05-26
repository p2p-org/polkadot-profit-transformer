export interface IBlocksStatusResult {
  status: string
  fin_height_diff: number
  height_diff: number
}

export interface IBlocksService {
  getLastProcessedBlock(): Promise<number>
  processBlock(blockNumber: number, fromWatchdog: boolean): Promise<void>
  processBlocks(startBlockNumber: number | undefined, optionSubscribeFinHead: boolean | null): Promise<void>
  trimAndUpdateToFinalized(blockId: number): Promise<{ result: boolean }>
  updateOneBlock(blockNumber: number): Promise<true>
  removeBlocks(blockNumbers: number[]): Promise<{ result: true }>
  getBlocksStatus(): Promise<IBlocksStatusResult>
}

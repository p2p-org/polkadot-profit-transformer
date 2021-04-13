export interface IBlocksService {
  getLastProcessedBlock(): Promise<number>
  processBlock(blockNumber: number, fromWatchdog: boolean): Promise<void>
  processBlocks(startBlockNumber: number | null): Promise<void>
  trimAndUpdateToFinalized(blockId: string): Promise<{ result: boolean }>
  updateOneBlock(blockNumber: number): Promise<true>
  removeBlocks(blockNumbers: number[]): Promise<{ result: true }>
}

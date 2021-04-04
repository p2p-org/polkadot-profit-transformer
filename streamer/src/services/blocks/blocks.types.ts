export interface IBlocksService {
	getLastProcessedBlock(): Promise<number>;
	processBlock(blockNumber: number): Promise<void>;
	processBlocks(
		startBlockNumber: number | null
	): Promise<void>;
	trimAndUpdateToFinalized(blockId: string): Promise<{ result: boolean; }>;
}

export interface IConsumerService {
	subscribeFinalizedHeads(): Promise<void>;
}

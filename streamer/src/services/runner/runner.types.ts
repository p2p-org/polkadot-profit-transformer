export interface IRunnerService {
	sync(
		options: {
			optionSync: boolean,
			optionSyncForce: boolean,
			optionSyncValidators: boolean,
			optionSyncStartBlockNumber: number,
			optionSubscribeFinHead: boolean,
		}
	): Promise<void>;
}

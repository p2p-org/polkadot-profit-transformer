export interface IRunnerService {
  sync(options: {
    optionSync: boolean
    optionSyncForce: boolean
    optionSyncStartBlockNumber: number | undefined
    optionSubscribeFinHead: boolean
    optionStartWatchdog: boolean
    optionWatchdogStartBlockNumber: number | undefined
  }): Promise<void>
}

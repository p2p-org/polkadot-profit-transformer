export interface IRunnerService {
  sync(options: {
    optionSync: boolean
    optionSyncForce: boolean
    optionSyncValidators: boolean
    optionSyncStartBlockNumber: number
    optionSubscribeFinHead: boolean
    optionStartWatchdog: boolean
    optionWatchdogStartBlockNumber: number | undefined
    optionWatchdogConcurrency: number
  }): Promise<void>
}

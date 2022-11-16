import { environment, MODE } from '@/environment'

export const ModulesLoader = async (): Promise<void> => {
  if (environment.MODE === MODE.LISTENER) {
    require('./BlockListener')
  }

  if (environment.MODE === MODE.BLOCK_PROCESSOR) {
    //    require('./BlockProcessor')

    require('./BlockMetadataProcessor')
  }

  if (environment.MODE === MODE.STAKING_PROCESSOR) {
    if (environment.NETWORK === 'polkadot' || environment.NETWORK === 'kusama') {
      require('./PolkadotStakingProcessor')
    } else if (environment.NETWORK === 'moonbeam' || environment.NETWORK === 'moonriver') {
      require('./MoonbeamStakingProcessor')
    }
  }
}

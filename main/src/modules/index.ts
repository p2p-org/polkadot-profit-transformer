import { environment, MODE, NODE_ENV } from '@/environment'
//import BlockMetadataProcessor from './BlockMetadataProcessor'
import BlockProcessor from './BlockProcessor'
import BlockListener from './BlockListener'
import MoonbeamStakingProcessor from './MoonbeamStakingProcessor'
//import MoonbeamStakingProcessorRecalc from './MoonbeamStakingProcessorRecalc'
import PolkadotStakingProcessor from './PolkadotStakingProcessor'
import IdentityProcessor from './IdentityProcessor'
import Monitoring from './Monitoring'

export const ModulesLoader = async (): Promise<void> => {
  if (environment.MODE === MODE.LISTENER) {
    BlockListener()
  }

  if (environment.MODE === MODE.BLOCK_PROCESSOR) {
    BlockProcessor()
    //BlockMetadataProcessor()
  }

  if (environment.MODE === MODE.STAKING_PROCESSOR) {
    if (environment.NETWORK === 'polkadot' || environment.NETWORK === 'kusama') {
      PolkadotStakingProcessor()
    } else if (environment.NETWORK === 'moonbeam' || environment.NETWORK === 'moonriver') {
      MoonbeamStakingProcessor()
      //MoonbeamStakingProcessorRecalc()
    }
  }

  if (environment.MODE === MODE.IDENTITY_PROCESSOR) {
    IdentityProcessor()
  }

  if (environment.MODE === MODE.MONITORING && environment.NODE_ENV !== NODE_ENV.DEVELOPMENT) {
    Monitoring()
  }
}

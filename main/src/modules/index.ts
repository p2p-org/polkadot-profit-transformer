import { environment, MODE } from '@/environment'
import BlockMetadataProcessor from './BlockMetadataProcessor';
import BlockProcessor from './BlockProcessor';
import BlockListener from './BlockListener';
import MoonbeamStakingProcessor from './MoonbeamStakingProcessor';
import PolkadotStakingProcessor from './PolkadotStakingProcessor';

export const ModulesLoader = async (): Promise<void> => {
  if (environment.MODE === MODE.LISTENER) {
    BlockListener()
  }

  if (environment.MODE === MODE.BLOCK_PROCESSOR) {
    BlockProcessor()
    BlockMetadataProcessor()
  }

  if (environment.MODE === MODE.STAKING_PROCESSOR) {
    if (environment.NETWORK === 'polkadot' || environment.NETWORK === 'kusama') {
      PolkadotStakingProcessor()
    } else if (environment.NETWORK === 'moonbeam' || environment.NETWORK === 'moonriver') {
      MoonbeamStakingProcessor()
    }
  }
}

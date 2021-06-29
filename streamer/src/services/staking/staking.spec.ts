import { StakingService } from './staking'

import { KafkaModule } from '../../modules/kafka.module'
import { PolkadotModule } from '../../modules/polkadot.module'
import { LoggerModule } from '../../modules/logger.module'
import { BlockRepository } from '../../repositories/block.repository'
import { Codec } from '@polkadot/types/types'

jest.mock('../../repositories/block.repository')
jest.mock('../../modules/kafka.module')
jest.mock('../../modules/polkadot.module')
jest.mock('../../modules/logger.module')

BlockRepository.inject = jest.fn(() => new BlockRepository())
KafkaModule.inject = jest.fn(() => new KafkaModule())
PolkadotModule.inject = jest.fn(() => new PolkadotModule())
LoggerModule.inject = jest.fn(() => new LoggerModule())

BlockRepository.prototype.getFirstBlockInEra = jest.fn(async (eraId: number) => ({
  id: '5000',
  hash: 'adasdasd',
  state_root: 'asdasd',
  extrinsics_root: 'asdasd',
  parent_hash: 'asdasdasdsa',
  author: 'asdasdasd',
  session_id: 50,
  era: eraId,
  last_log: 'asdasdasd',
  digest: { logs: ['asdf'] as [any] },
  block_time: new Date()
}))

PolkadotModule.prototype.getBlockTime = jest.fn(async () => Date.now())
PolkadotModule.prototype.getDistinctValidatorsAccountsByEra = jest.fn(async () => {
  const accounts = ['aaaaaaaaaaaa', 'bbbbbbbbbbbb', 'ccccccccccccc', 'dddddddddddd']
  return new Set(accounts)
})

PolkadotModule.prototype.getRewardPoints = jest.fn(async () => {
  const accounts: [string, number][] = [
    ['aaaaaaaaaaaa', 5],
    ['bbbbbbbbbbbb', 10],
    ['ccccccccccccc', 1],
    ['dddddddddddd', 50]
  ]
  return new Map(accounts)
})

test('static inject', () => {
  const stakingService = StakingService.inject()
  expect(stakingService).toBeInstanceOf(StakingService)
  const stakingService2 = StakingService.inject()
  expect(stakingService).toBe(stakingService2)
})

// test('processEraPayout', async () => {
//   const stakingService = StakingService.inject()
//   const result = await stakingService.processEraPayout({
//     eraPayoutEvent: {
//       event: {
//         // eslint-disable-next-line @typescript-eslint/ban-ts-comment
//         //@ts-ignore
//         data: [100]
//       }
//     },
//     blockHash: 'aaaaaaaaaaaaaaaaaa'
//   }, () => {1===1})

//   expect(result).toBeCalledTimes(1)
// })

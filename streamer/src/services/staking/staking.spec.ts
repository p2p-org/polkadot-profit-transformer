import { StakingService } from './staking'

import { KafkaModule } from '../../modules/kafka'
import { PolkadotModule } from '../../modules/polkadot.module'
import { LoggerModule } from '../../modules/logger.module'
import { BlockRepository } from '../../repositories/block.repository'

jest.mock('../../repositories/block.repository')
jest.mock('../../modules/kafka')
jest.mock('../../modules/polkadot.module')
jest.mock('../../modules/logger.module')

BlockRepository.inject = jest.fn(() => new BlockRepository())
KafkaModule.inject = jest.fn(() => new KafkaModule())
PolkadotModule.inject = jest.fn(() => new PolkadotModule())
LoggerModule.inject = jest.fn(() => new LoggerModule())

BlockRepository.prototype.getFirstBlockInEra = jest.fn(async (eraId: number) => {
  if (eraId) {
    return {
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
    }
  }

  return null
})

PolkadotModule.prototype.getBlockTime = jest.fn(async () => Date.now())
PolkadotModule.prototype.getDistinctValidatorsAccountsByEra = jest.fn(async () => {
  const accounts = ['aaaaaaaaaaaa','bbbbbbbbbbbb','ccccccccccccc','dddddddddddd']
  return new Set(accounts)
})

PolkadotModule.prototype.getRewardPoints = jest.fn(async () => {
  const accounts: [string, number][] = [
      ['aaaaaaaaaaaa', 5],
      ['bbbbbbbbbbbb', 10],
      ['ccccccccccccc', 1]
  ]
  return new Map(accounts)
})


// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
PolkadotModule.prototype.getStakersInfo = jest.fn(async () => {
  const pref = {
    a: 1,
    toJSON() {
      return this.a
    }
  }

  return [
    {
      total: '100',
      own: '100',
      others: [{
        who: 'asdfasfasdf',
        value: 5
      }]
    }, {
      others: [{
        who: 'asdfasfasdf'
      }]
    }, pref
  ]
})

test('static inject', () => {
  const stakingService = StakingService.inject()
  expect(stakingService).toBeInstanceOf(StakingService)
  const stakingService2 = StakingService.inject()
  expect(stakingService).toBe(stakingService2)
})

test('getValidatorsAndNominatorsData', async() => {
  const stakingService = StakingService.inject()
  const exec = stakingService.getValidatorsAndNominatorsData({
    blockHash: 'aaaaaaaaaaaaa',
    eraId: 0
  })
  await expect(exec).rejects.toThrow(`first block of 0 not found in DB`)

  const result = await stakingService.getValidatorsAndNominatorsData({
    blockHash: 'aaaaaaaaaaaaa',
    eraId: 5
  })

  expect(result.nominators).toHaveLength(4)
  expect(result.validators).toHaveLength(4)
})

test('processEraPayout', async () => {
  const stakingService = StakingService.inject()
  const result = await stakingService.processEraPayout({
    eraId: '100',
    blockHash: 'aaaaaaaaaaaaaaaaaa'
  }, () => {1===1})

  expect(result).toBe(undefined)

  const result2 = await stakingService.processEraPayout({
    eraId: '0',
    blockHash: 'aaaaaaaaaaaaaaaaaa'
  }, () => {1===1})

  expect(result2).toBe(undefined)
})

test('addToQueue', async () => {
  const stakingService = StakingService.inject()
  const result = stakingService.addToQueue({
    eraId: '100',
    blockHash: 'aaaaaaaaaaaaaaaaaa'
  })

  expect(result).toBe(undefined)
})

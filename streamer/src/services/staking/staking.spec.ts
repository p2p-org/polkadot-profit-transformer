import { StakingService } from './staking'

jest.mock('../../repositories/block.repository')
jest.mock('../../modules/kafka.module')
jest.mock('../../modules/polkadot.module')
jest.mock('../../modules/logger.module')

test('static inject', () => {
  const stakingService = StakingService.inject()
  expect(stakingService).toBeInstanceOf(StakingService)
  const stakingService2 = StakingService.inject()
  expect(stakingService).toBe(stakingService2)
})

test('getEraData', async () => {})

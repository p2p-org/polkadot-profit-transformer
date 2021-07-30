import { ConsumerService } from './consumer'
import { BlocksService } from '../blocks'
import { BlockRepository } from '@repositories/block.repository'
import { PolkadotModule } from '@modules/polkadot.module'
import { LoggerModule } from '@modules/logger.module'

jest.mock('@services/blocks')
jest.mock('@modules/polkadot.module')
jest.mock('@modules/logger.module')
jest.mock('@repositories/block.repository')

BlocksService.inject = jest.fn(() => new BlocksService())

BlocksService.isSyncComplete = jest.fn(
  (() => {
    let syncComplete = 0
    return () => {
      return !!syncComplete++
    }
  })()
)
BlocksService.prototype.processBlock = jest.fn(
  (() => {
    let counter = 0
    return async () => {
      if (counter) {
        throw new Error(`no matter`)
      }
      counter++
    }
  })()
)

BlockRepository.inject = jest.fn(() => new BlockRepository())
BlockRepository.prototype.getLastProcessedBlock = jest.fn(
  (() => {
    const testValues = [0, 0, 1, 1, 1, 1, 1, 2]
    return async () => {
      const value = testValues.shift()
      if (typeof value === 'number') {
        return value
      }

      throw new Error('Test is broken')
    }
  })()
)

PolkadotModule.inject = jest.fn(() => new PolkadotModule())
PolkadotModule.prototype.subscribeFinalizedHeads = jest.fn(
  (() => {
    const testValues = [0, 0, 2]
    return async function (cb: any) {
      const value = testValues.shift()
      const header = {
        number: {
          toNumber() {
            if (typeof value === 'number') {
              return value
            }

            throw new Error('Test is broken')
          }
        }
      }
      return cb(header)
    }
  })()
)

LoggerModule.inject = jest.fn(() => new LoggerModule())

test('subscribeFinalizedHeads', async () => {
  const getLastProcessedBlock = jest.spyOn(BlockRepository.prototype, 'getLastProcessedBlock')
  const trimAndUpdateToFinalized = jest.spyOn(BlocksService.prototype, 'trimAndUpdateToFinalized')
  const processBlock = jest.spyOn(BlocksService.prototype, 'processBlock')
  const service = new ConsumerService()
  const serviceCopy = new ConsumerService()

  await service.subscribeFinalizedHeads()
  expect(getLastProcessedBlock).toBeCalledTimes(0)

  await service.subscribeFinalizedHeads()
  expect(getLastProcessedBlock).toBeCalledTimes(2)
  expect(trimAndUpdateToFinalized).toBeCalledTimes(0)

  await service.subscribeFinalizedHeads()
  expect(getLastProcessedBlock).toBeCalledTimes(4)
  expect(trimAndUpdateToFinalized).toBeCalledTimes(1)
  expect(processBlock).toBeCalledTimes(1)

  await service.subscribeFinalizedHeads()
  expect(getLastProcessedBlock).toBeCalledTimes(6)
  expect(trimAndUpdateToFinalized).toBeCalledTimes(1)
  expect(processBlock).toBeCalledTimes(2)

  expect(service).toBe(serviceCopy)
})

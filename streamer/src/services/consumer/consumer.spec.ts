import { ConsumerService } from './consumer'
import { BlocksService } from '../blocks'
import { BlockRepository } from '../../repositories/block.repository'
import { PolkadotModule } from '../../modules/polkadot.module'
import { LoggerModule } from '../../modules/logger.module'
import { Header } from '@polkadot/types/interfaces'

jest.mock('../blocks')
jest.mock('../../modules/polkadot.module')
jest.mock('../../modules/logger.module')
jest.mock('../../repositories/block.repository')


BlocksService.isSyncComplete = jest.fn((() => {
	let syncComplete = true
	return () => {
		syncComplete = !syncComplete
		return syncComplete
	}
})())

BlockRepository.inject = jest.fn(() => new BlockRepository())
PolkadotModule.inject = jest.fn(() => new PolkadotModule())
LoggerModule.inject = jest.fn(() => new LoggerModule())

BlockRepository.prototype.getLastProcessedBlock = jest.fn((() => {
	let blockNumberFromDB = -1
	return async () => {
		return blockNumberFromDB++
	}
})())

PolkadotModule.prototype.subscribeFinalizedHeads = jest.fn((cb) => {
	const header = {
		number: {
			toNumber() {
				return 1
			}
		}
	}
	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	//@ts-ignore
	return cb(header)
})

test('subscribeFinalizedHeads', async () => {
	const service = new ConsumerService()

	await service.subscribeFinalizedHeads()
	await service.subscribeFinalizedHeads()
	await service.subscribeFinalizedHeads()
	await service.subscribeFinalizedHeads()
	await service.subscribeFinalizedHeads()

})

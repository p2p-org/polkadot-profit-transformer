import { WatchdogService } from '@services/watchdog'
import { ConfigService } from '@services/config'
import { BlockRepository } from '@repositories/block.repository'
import { EraRepository } from '@repositories/era.repository'
import { EventRepository } from '@repositories/event.repository'
import { ExtrinsicRepository } from '@repositories/extrinsic.repository'
import { LoggerModule } from '@modules/logger.module'
import { PolkadotModule } from '@modules/polkadot.module'

jest.mock('@services/config')
jest.mock('@services/blocks')
jest.mock('@repositories/block.repository')
jest.mock('@repositories/era.repository')
jest.mock('@repositories/event.repository')
jest.mock('@repositories/extrinsic.repository')
jest.mock('@modules/kafka')
jest.mock('@modules/polkadot.module')
jest.mock('@modules/logger.module')

BlockRepository.inject = jest.fn(() => new BlockRepository())
BlockRepository.prototype.getLastProcessedBlock = jest.fn(async () => 5)
BlockRepository.prototype.getBlockById = jest.fn((() => {
	const blockFromDb = {
		id: 4,
		hash: 'asdfsadf'
	}
	return async (id: number) => {
		if (id === 4) return blockFromDb

		return undefined
	}
})())

LoggerModule.inject = jest.fn(() => new LoggerModule())
PolkadotModule.inject = jest.fn(() => new PolkadotModule())
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
PolkadotModule.prototype.getSystemEventsCount = jest.fn(async  () => ({
	toNumber() {
		return 4
	}
}))
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
PolkadotModule.prototype.getBlockData = jest.fn(async () => ({
		block: {
			header: {
				parentHash: {
					toString() {
						return 'aaaaaaaaaaaaaa'
					}
				}
			},
			extrinsics: [{
				method: {
					method: 'aaaaaa',
					args: ['asd']
				}
			}, {
				method: {
					method: 'batch',
					args: ['asd']
				}
			}]
		}
	})
)

describe('WatchdogService', () => {
	const service = WatchdogService.getInstance()
	const getConfigValueFromDB = jest.spyOn(ConfigService.prototype, 'getConfigValueFromDB')
	const updateConfigValueInDB = jest.spyOn(ConfigService.prototype, 'updateConfigValueInDB')

	test('run with no start block', async () => {
		service.run(undefined)
		await new Promise(resolve => setImmediate(resolve))
		expect(getConfigValueFromDB).toHaveBeenCalledTimes(2)
		expect(updateConfigValueInDB).toHaveBeenCalledTimes(3)
		await service.restartFromBlockId(2)
	})
})

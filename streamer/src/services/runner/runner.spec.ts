import { RunnerService } from './runner'
import { WatchdogService } from '../watchdog'

jest.mock('../blocks')
jest.mock('../config')
jest.mock('../watchdog')
jest.mock('../consumer')

WatchdogService.getInstance = jest.fn(() => new WatchdogService())

test('sync', async () => {
	const service = new RunnerService()
	await service.sync({
		optionSync: true,
		optionSyncForce: true,
		optionSyncStartBlockNumber: 10000,
		optionSubscribeFinHead: false,
		optionStartWatchdog: false,
		optionWatchdogStartBlockNumber: undefined
	})

	await service.sync({
		optionSync: false,
		optionSyncForce: false,
		optionSyncStartBlockNumber: undefined,
		optionSubscribeFinHead: true,
		optionStartWatchdog: false,
		optionWatchdogStartBlockNumber: undefined
	})

	await service.sync({
		optionSync: false,
		optionSyncForce: false,
		optionSyncStartBlockNumber: undefined,
		optionSubscribeFinHead: false,
		optionStartWatchdog: true,
		optionWatchdogStartBlockNumber: 500
	})
})

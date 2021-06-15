import { RunnerService } from './runner'
import { WatchdogService } from '../watchdog'
import { BlocksService } from '@services/blocks'
import { ConsumerService } from '@services/consumer'
import { ConfigService } from '@services/config'

jest.mock('../blocks')
jest.mock('../config')
jest.mock('../watchdog')
jest.mock('../consumer')

WatchdogService.getInstance = jest.fn(() => new WatchdogService())

test('sync', async () => {
	const bootstrapConfig = jest.spyOn(ConfigService.prototype, 'bootstrapConfig')
	const processBlock = jest.spyOn(BlocksService.prototype, 'processBlocks')
	const subscribeFinalizedHeads = jest.spyOn(ConsumerService.prototype, 'subscribeFinalizedHeads')
	const run = jest.spyOn(WatchdogService.prototype, 'run')

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
		optionSync: true,
		optionSyncForce: false,
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

	await service.sync({
		optionSync: false,
		optionSyncForce: false,
		optionSyncStartBlockNumber: undefined,
		optionSubscribeFinHead: false,
		optionStartWatchdog: false,
		optionWatchdogStartBlockNumber: undefined
	})

	expect(bootstrapConfig).toHaveBeenCalledTimes(5)
	expect(processBlock).toHaveBeenCalledTimes(2)
	expect(subscribeFinalizedHeads).toHaveBeenCalledTimes(1)
	expect(run).toHaveBeenCalledTimes(1)
})

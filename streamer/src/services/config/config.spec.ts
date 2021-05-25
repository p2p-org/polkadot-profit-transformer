import { ConfigService } from './config'
import { LoggerModule } from '../../modules/logger.module'
import { PolkadotModule } from '../../modules/polkadot.module'
import { PostgresModule } from '../../modules/postgres.module'
import { Pool } from 'pg'

const data = []
const MockPool = jest.genMockFromModule<Pool>('Pool')

MockPool.query = jest.fn(async ({ text, values }) => {
	data
})

beforeAll(async () => {
	await LoggerModule.init()
	await PolkadotModule.init()
	await PostgresModule.init()
})

test('constructor', async () => {
	const pool = PostgresModule.inject()
	const logger = LoggerModule.inject()
	const polkadotApi = PolkadotModule.inject()
	const configService = new ConfigService(pool, polkadotApi, logger)
	expect(configService).toBeInstanceOf(ConfigService)
})

test('setConfigValueToDB', async () => {
	const pool = PostgresModule.inject()
	const logger = LoggerModule.inject()
	const polkadotApi = PolkadotModule.inject()
	const configService = new ConfigService(pool, polkadotApi, logger)

	const configValue = await configService.setConfigValueToDB('asd', 5)

	expect(configService.setConfigValueToDB).toHaveBeenCalled()
})

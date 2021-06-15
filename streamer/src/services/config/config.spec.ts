import { ConfigService } from './config'
import { ConfigRepository } from '@repositories/config.repository'
import { PolkadotModule } from '@modules/polkadot.module'
import { LoggerModule } from '@modules/logger.module'

jest.mock('../../repositories/config.repository')
jest.mock('../../modules/polkadot.module')
jest.mock('../../modules/logger.module')

ConfigRepository.prototype.update = jest.fn(async (key: string, value: string | number) => {
  const index = data.findIndex((row) => row.key === key)
  data[index] = {
    ...data[index],
    value
  }
})

ConfigRepository.prototype.insert = jest.fn(async (key: string, value: string | number) => {
  const index = data.findIndex((row) => row.key === key)

  if (index !== -1) throw new Error(`unique violoation`)

  data.push({
    key,
    value
  })
})

ConfigRepository.prototype.find = jest.fn(async (key: string): Promise<string | undefined> => {
  const record = data.find((row) => row.key === key)

  return record?.value.toString()
})

PolkadotModule.inject = jest.fn(() => new PolkadotModule())
PolkadotModule.prototype.getChainInfo = jest.fn(async (): Promise<[string, string]> => {
  return ['my_awesome_chain', 'my_awesome_chain_type']
})
LoggerModule.inject = jest.fn(() => new LoggerModule())

const data: Array<{ key: string; value: string | number }> = []

describe('ConfigService', () => {

  test('constructor', async () => {
    const configService = new ConfigService()
    expect(configService).toBeInstanceOf(ConfigService)
  })

  test('setConfigValueToDB', async () => {
    const configService = new ConfigService()

    await configService.setConfigValueToDB('test1', 5)
    const dbValue = await configService.getConfigValueFromDB('test1')

    expect(dbValue).toBe('5')
    await expect(configService.setConfigValueToDB('', 'zzzz')).rejects.toThrow('"key" is empty')

    const key = 'abra'

    await expect(configService.setConfigValueToDB(key, '')).rejects.toThrow(`setConfigValueToDB "value" for key ${key} is empty`)
  })

  test('getConfigValueFromDB', async () => {
    const configService = new ConfigService()

    await configService.setConfigValueToDB('test2', 55)
    const dbValue = await configService.getConfigValueFromDB('test2')

    expect(dbValue).toBe('55')
    await expect(configService.getConfigValueFromDB('')).rejects.toThrow('"key" is empty')
  })

  test('updateConfigValueInDB', async () => {
    const configService = new ConfigService()

    await configService.setConfigValueToDB('test3', 5)
    await configService.updateConfigValueInDB('test3', 19)
    const dbValue = await configService.getConfigValueFromDB('test3')

    expect(dbValue).toBe('19')
    await expect(configService.updateConfigValueInDB('', 5515)).rejects.toThrow('updateConfigValueInDB "key" is empty')
  })

  test('bootstrapConfig', async () => {
    const configService = new ConfigService()

    await configService.bootstrapConfig()

    const [dbChain, dbChainType] = await Promise.all([
      configService.getConfigValueFromDB('chain'),
      configService.getConfigValueFromDB('chain_type')
    ])

    expect(dbChain).toBe('my_awesome_chain')
    expect(dbChainType).toBe('my_awesome_chain_type')

    const [watchdogVerifyHeight, watchdogStartedAt, watchdogFinishedAt] = await Promise.all([
      configService.getConfigValueFromDB('watchdog_verify_height'),
      configService.getConfigValueFromDB('watchdog_started_at'),
      configService.getConfigValueFromDB('watchdog_finished_at')
    ])

    expect(watchdogVerifyHeight).toBe('-1')
    expect(watchdogStartedAt).toBe('0')
    expect(watchdogFinishedAt).toBe('0')

    const [anotherChain, anotherChainType] = ['another_chain', 'another_chain_type']

    await configService.updateConfigValueInDB('chain_type', anotherChainType)
    await expect(configService.bootstrapConfig()).rejects.toThrow(
        `Node "system.chainType" not compare to saved type: "${dbChainType}" and "${anotherChainType}`
    )

    await configService.updateConfigValueInDB('chain', anotherChain)
    await expect(configService.bootstrapConfig()).rejects.toThrow(
        `Node "system.chain" not compare to saved type: "${dbChain}" and "${anotherChain}"`
    )

    await configService.updateConfigValueInDB('chain', 'my_awesome_chain')
    await configService.updateConfigValueInDB('chain_type', 'my_awesome_chain_type')

    await expect(configService.bootstrapConfig())
  })
})

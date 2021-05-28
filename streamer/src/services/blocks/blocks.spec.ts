import { IStakingService } from './../staking/staking.types'
import { KafkaModule } from './../../modules/kafka.module'
import { BlockHash, EraIndex } from '@polkadot/types/interfaces'
import { IBlock } from './../watchdog/watchdog.types'
import { BlocksService } from './blocks'
import { BlockRepository } from '../../repositories/block.repository'
import { Logger } from 'pino'
import { Option } from '@polkadot/types'
import { HeaderExtended } from '@polkadot/api-derive/types'
import { IExtrinsicsService } from '../extrinsics/extrinsics.types'
import { IConsumerService } from '../consumer/consumer.types'
import { PolkadotModule } from '../../modules/polkadot.module'

jest.mock('../../repositories/block.repository')
jest.mock('../../modules/polkadot.module')
jest.mock('../../modules/logger.module')

const mockKafka = {
  instance: {
    ready: true
  },
  sendBlockData: () => true
}

const mockExtrinsicsService: IExtrinsicsService = {
  extractExtrinsics: jest.fn(async () => {
    return
  })
}

const mockStakingService: IStakingService = {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  addToQueue: jest.fn(async ({ eraPayoutEvent, blockHash }) => {
    return
  })
}
const mockConsumerService: IConsumerService = {
  subscribeFinalizedHeads: jest.fn(async () => {
    return
  })
}

const mockBlocksRepository = jest.createMockFromModule<BlockRepository>('../../repositories/block.repository')

const blockMock: IBlock = {
  id: '123',
  hash: '123',
  state_root: '123',
  extrinsics_root: '123',
  parent_hash: '123',
  author: '123',
  session_id: 123,
  era: 123,
  last_log: '123',
  digest: { logs: [1] },
  block_time: new Date()
}

mockBlocksRepository.getLastProcessedBlock = jest.fn(async () => {
  return 100
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
mockBlocksRepository.getFirstBlockInEra = jest.fn(async (eraId: number) => {
  return blockMock
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
mockBlocksRepository.getFirstBlockInSession = jest.fn(async (sessionId: number) => {
  return blockMock
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
mockBlocksRepository.removeBlockData = jest.fn(async (blockNumbers: number[]) => {
  return
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
mockBlocksRepository.trimBlocksFrom = jest.fn(async (startBlockNumber: number) => {
  return
})

const mockPolkadotApi = jest.createMockFromModule<PolkadotModule>('@polkadot/api/index')
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
mockPolkadotApi.query = {
  session: {
    currentIndex: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      at: jest.fn(async (blockHash: BlockHash) => {
        return {
          toNumber: () => 1
        }
      })
    }
  },
  staking: {
    currentEra: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      at: jest.fn(async (blockHash: BlockHash): Promise<Option<EraIndex>> => {
        return (<unknown>'12') as Option<EraIndex>
      })
    },
    activeEra: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      at: jest.fn(async (blockHash: BlockHash) => {
        return {
          unwrap: () => {
            return {
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              get: (param: string) => {
                return 1
              }
            }
          }
        }
      })
    }
  },
  timestamp: {
    now: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      at: jest.fn(async (blockHash: BlockHash) => {
        return {
          toNumber: () => 12345678
        }
      })
    }
  },
  system: {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    events: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      at: jest.fn(async (blockHash: BlockHash) => {
        return [
          {
            phase: { toJSON: () => ({ json: true }) },
            event: {
              toJSON: () => ({ json: true }),
              section: 'staking',
              method: 'EraPayout',
              meta: {
                toJSON: () => ({ json: true })
              },
              data: []
            }
          }
        ]
      })
    }
  }
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
mockPolkadotApi.rpc = {
  chain: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getBlock: jest.fn(async (blockHash: BlockHash) => {
      return {
        block: {
          header: {
            stateRoot: {
              toHex: () => 0x111
            },

            hash: {
              toHex: () => 0x222
            },
            extrinsicsRoot: {
              toHex: () => 0x333
            },
            parentHash: {
              toHex: () => 0x444
            },
            number: {
              toNumber: () => 5
            },
            digest: {
              logs: [
                {
                  type: 'events'
                }
              ]
            }
          }
        }
      }
    }),
    getBlockHash: jest.fn(async (height: number) => {
      return height === -1 ? null : 'hash'
    }),
    getFinalizedHead: () => 1,
    getHeader: () => {
      return {
        number: {
          toNumber: () => 2
        }
      }
    }
  }
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
mockPolkadotApi.derive = {
  chain: {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    getHeader: jest.fn(async (blockHash: BlockHash): Promise<HeaderExtended | undefined> => {
      return (<unknown>'1111111') as HeaderExtended | undefined
    })
  }
}

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
const mockLogger = jest.createMockFromModule<Logger>('pino')
mockLogger.info = jest.fn(() => {
  1 + 1
})

mockLogger.error = jest.fn(() => {
  1 + 1
})

test('constructor', async () => {
  const blocksService = new BlocksService(
    mockBlocksRepository,
    mockPolkadotApi,
    mockLogger,
    mockKafka as unknown as KafkaModule,
    mockExtrinsicsService,
    mockStakingService,
    mockConsumerService
  )
  expect(blocksService).toBeInstanceOf(BlocksService)
})

test('processBlock', async () => {
  const blocksService = new BlocksService(
    mockBlocksRepository,
    mockPolkadotApi,
    mockLogger,
    mockKafka as unknown as KafkaModule,
    mockExtrinsicsService,
    mockStakingService,
    mockConsumerService
  )

  const existingBlockHeight = 1
  const notExistingBlockHeight = -1

  await expect(blocksService.processBlock(notExistingBlockHeight)).rejects.toThrow('cannot get block hash')

  await blocksService.processBlock(existingBlockHeight)
})

test('processBlocks from 0', async () => {
  const blocksService = new BlocksService(
    mockBlocksRepository,
    mockPolkadotApi,
    mockLogger,
    mockKafka as unknown as KafkaModule,
    mockExtrinsicsService,
    mockStakingService,
    mockConsumerService
  )

  await blocksService.processBlocks()
})

// todo - check if invoked inside IF statement in  processBlocks while loop
test('processBlocks from pre-last', async () => {
  const blocksService = new BlocksService(
    mockBlocksRepository,
    mockPolkadotApi,
    mockLogger,
    mockKafka as unknown as KafkaModule,
    mockExtrinsicsService,
    mockStakingService,
    mockConsumerService
  )

  await blocksService.processBlocks(1)
})

// todo - check if consumerService.subscribeFinalizedHeads() invoked
test('processBlockswith finalized head', async () => {
  const blocksService = new BlocksService(
    mockBlocksRepository,
    mockPolkadotApi,
    mockLogger,
    mockKafka as unknown as KafkaModule,
    mockExtrinsicsService,
    mockStakingService,
    mockConsumerService
  )

  await blocksService.processBlocks(1, true)
})

test('getBlocksStatus', async () => {
  const blocksService = new BlocksService(
    mockBlocksRepository,
    mockPolkadotApi,
    mockLogger,
    mockKafka as unknown as KafkaModule,
    mockExtrinsicsService,
    mockStakingService,
    mockConsumerService
  )

  const status = await blocksService.getBlocksStatus()

  expect(status).toBeDefined()
})

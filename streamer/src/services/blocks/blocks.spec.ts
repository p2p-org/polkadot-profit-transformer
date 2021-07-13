import { IBlockData } from './blocks.types'
import { BlockHash } from '@polkadot/types/interfaces'
import { BlocksService } from './blocks'
import { BlockRepository } from '@repositories/block.repository'
import { KafkaModule } from '@modules/kafka'
import { LoggerModule } from '@modules/logger.module'
import { PolkadotModule } from '@modules/polkadot.module'
import { IBlock } from '@services/watchdog'
import { ExtrinsicsService } from '@services/extrinsics/'
import { StakingService } from '@services/staking/'
import { ConsumerService } from '@services/consumer/'

jest.mock('@repositories/block.repository')
jest.mock('@modules/polkadot.module')
jest.mock('@modules/logger.module')
jest.mock('@modules/kafka')
jest.mock('@services/extrinsics')
jest.mock('@services/staking')
jest.mock('@services/consumer')

LoggerModule.inject = jest.fn(() => new LoggerModule())
KafkaModule.inject = jest.fn(() => new KafkaModule())
PolkadotModule.inject = jest.fn(() => new PolkadotModule())
StakingService.inject = jest.fn(() => new StakingService())
BlockRepository.inject = jest.fn(() => new BlockRepository())

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

BlockRepository.prototype.getLastProcessedBlock = jest.fn(async () => 2)

// eslint-disable-next-line @typescript-eslint/no-unused-vars
BlockRepository.prototype.getFirstBlockInEra = jest.fn(async (eraId: number) => {
  return blockMock
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
BlockRepository.prototype.getFirstBlockInSession = jest.fn(async (sessionId: number) => {
  return blockMock
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
BlockRepository.prototype.removeBlockData = jest.fn(async (blockNumbers: number[]) => {
  return
})

// eslint-disable-next-line @typescript-eslint/no-unused-vars
BlockRepository.prototype.trimBlocksFrom = jest.fn(async (startBlockNumber: number) => {
  return
})

PolkadotModule.prototype.getBlockHashByHeight = jest.fn(async (height: number): Promise<BlockHash> => {
  return height.toString() as unknown as BlockHash
})

PolkadotModule.prototype.getFinBlockNumber = jest.fn(async () => {
  return 15
})

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
PolkadotModule.prototype.getHeader = jest.fn(async () => {
  return {
    number: {
      toNumber: () => 2
    }
  }
})

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
PolkadotModule.prototype.getInfoToProcessBlock = jest.fn(async (blockHash: BlockHash) => {
  return [
    {
      toNumber: () => 123
    },
    '12',
    {
      unwrap: () => {
        return {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          get: (param: string) => {
            return 1
          }
        }
      }
    },
    {
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
            toString: () => {
              return `{ type: 'events' }`
            },
            logs: [
              {
                type: 'events'
              }
            ]
          }
        },
        extrinsics: [1, 2, 3]
      }
    },
    {
      author: {
        toString: () => 'author'
      },
      number: {
        toNumber: () => 2
      }
    },
    {
      toNumber: () => 12345678
    },

    [
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
  ]
})

// eslint-disable-next-line @typescript-eslint/ban-ts-comment
//@ts-ignore
PolkadotModule.prototype.getBlockHashByHeight = jest.fn(async (height: number) => {
  return height === -1 ? null : 'hash'
})

StakingService.prototype.addToQueue = jest.fn(async () => true)

KafkaModule.prototype.sendBlockData = jest.fn(async (blockData: IBlockData) => {})

ExtrinsicsService.prototype.extractExtrinsics = jest.fn(async (...args) => {})

ConsumerService.prototype.subscribeFinalizedHeads = jest.fn()

test('constructor', async () => {
  const blocksService = new BlocksService()
  expect(blocksService).toBeInstanceOf(BlocksService)
})

test('process not existing block', async () => {
  const blocksService = new BlocksService()

  const notExistingBlockHeight = -1

  await expect(blocksService.processBlock(notExistingBlockHeight)).rejects.toThrow('cannot get block hash')
})

test('send block data to kafka ', async () => {
  const blocksService = new BlocksService()

  const existingBlockHeight = 1

  await blocksService.processBlock(existingBlockHeight)

  await expect(KafkaModule.prototype.sendBlockData).lastCalledWith({
    block: {
      header: {
        number: 5,
        hash: 546,
        author: 'author',
        session_id: 123,
        currentEra: 12,
        era: 1,
        stateRoot: 273,
        extrinsicsRoot: 819,
        parentHash: 1092,
        last_log: 'events',
        digest: "{ type: 'events' }"
      }
    },
    events: [
      {
        id: '5-0',
        section: 'staking',
        method: 'EraPayout',
        phase: {
          json: true
        },
        meta: {
          json: true
        },
        data: [],
        event: {
          json: true
        }
      }
    ],
    block_time: 12345678
  })
})

describe('BlockService', () => {
  test('isSyncComplete method', async () => {
    await expect(BlocksService.isSyncComplete()).toBe(false)
  })

  test('processBlocks without params', async () => {
    const blocksService = new BlocksService()
    const status = await blocksService.getBlocksStatus()
    await expect(status).toEqual({ status: 'synchronization', height_diff: 13, fin_height_diff: -13 })

    await blocksService.processBlocks()

    await expect(BlockRepository.prototype.getLastProcessedBlock).toBeCalledTimes(2)
  })

  test('processBlocks from 0', async () => {
    const blocksService = new BlocksService()
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    blocksService.runBlocksWorker = jest.fn(async () => true)

    await blocksService.processBlocks(0)

    await expect(blocksService.runBlocksWorker).toBeCalledTimes(20)
  })

  // todo - check if invoked inside IF statement in  processBlocks while loop
  test('processBlocks from pre-last', async () => {
    const blocksService = new BlocksService()
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    //@ts-ignore
    blocksService.runBlocksWorker = jest.fn(async () => true)
    await blocksService.processBlocks(14)
    await expect(blocksService.runBlocksWorker).toBeCalledTimes(10)
  })

  // todo - check if consumerService.subscribeFinalizedHeads() invoked
  test('processBlockswith finalized head', async () => {
    const blocksService = new BlocksService()

    await blocksService.processBlocks(15, true)

    await expect(ConsumerService.prototype.subscribeFinalizedHeads).toBeCalled()
    const { result } = await blocksService.trimAndUpdateToFinalized(100)
    expect(result).toBeFalsy()
  })

  test('getBlocksStatus', async () => {
    const blocksService = new BlocksService()

    const status = await blocksService.getBlocksStatus()

    await expect(status).toEqual({ status: 'synchronized', height_diff: 13, fin_height_diff: -13 })
  })

  test('removeBlocks', async () => {
    const service = new BlocksService()
    const { result } = await service.removeBlocks([1, 2, 3])
    expect(result).toBeTruthy()
  })

  test('trimAndUpdateToFinalized', async () => {
    const service = new BlocksService()
    const { result } = await service.trimAndUpdateToFinalized(100)
    expect(result).toBeFalsy()
  })
})

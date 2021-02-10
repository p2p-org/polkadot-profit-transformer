const { equal } = require('assert')
const substrateConnector = require('../utils/substrateInterface')
const postgresConnector = require('../utils/postgres/postgres')
const postgresQueries = require('../utils/postgres/postgresQueries')

let api
let postgres
describe('Init', () => {
  before(async () => {
    try {
      postgres = postgresConnector.pool
      api = await substrateConnector.apiConnection()
    } catch (err) {
      console.log(err.stack)
      throw new Error(`Connection error`)
    }
  })

  it('Checking for "chain" and "chainType"', async () => {
    const [currentChainRaw, currentChainTypeRaw] = await Promise.all([
      await api.rpc.system.chain(), // Polkadot
      await api.rpc.system.chainType() // Live
    ])

    const currentChain = currentChainRaw.toString().trim()
    const currentChainType = currentChainTypeRaw.toString().trim()

    equal(currentChain, 'Polkadot')
    equal(currentChainType, 'Live')
  })

  it('Check indexator missed blocks', async () => {
    const missedBlocksCount = await postgresQueries.getMissedBlocksCount(postgres)
    equal(missedBlocksCount < 100, true, `Indexator has  ${missedBlocksCount} missed blocks`)
  })

  it('Check table eras for misses by validatorsCount in validators table ', async () => {
    const missedValidators = await postgresQueries.getMissedValidators(postgres)
    equal(
      missedValidators,
      0,
      'There is discrepancy between sum of validators_active in dot_polka.era and count ' +
        'of validators in dot_polka.validators for corresponding value of era '
    )
  })

  it('Check table eras for misses by nominatorsCount in nominators table ', async () => {
    const missedNominators = await postgresQueries.getMissedNominators(postgres)
    equal(
      missedNominators,
      0,
      'There is discrepancy between sum of nominators_active in dot_polka.era and count ' +
        'of nominators in dot_polka.nominators for corresponding value of era '
    )
  })

  it('Check missed hashes for sequence of blocks', async () => {
    const missedHashes = await postgresQueries.getMissedHashesForSequenceOfBlocks(postgres)
    equal(
      missedHashes.breakCount,
      0,
      `There is ${missedHashes.breakCount} hashes sequence breaks;Breaks info: ${JSON.stringify(missedHashes.info)}`
    )
  })

  it('Check node top block  with indexator top block', async () => {
    const indexatorTopBlock = await postgresQueries.getTopBlock(postgres)
    const nodeTopBlock = await api.rpc.chain.getHeader()
    const topBlockDifference = nodeTopBlock.number.toString() - indexatorTopBlock
    equal(topBlockDifference < 100, true, `Indexator top block is lag behind of node top block for ${topBlockDifference} blocks`)
  })

  it('Check eras for low total stake', async () => {
    const erasCountWithLowTotalStake = await postgresQueries.getErasWithLowTotalStack(postgres)
    equal(erasCountWithLowTotalStake, 0, `There is ${erasCountWithLowTotalStake} eras with low total stake`)
  })

  it('Check eras for low total reward', async () => {
    const erasCountWithLowTotalReward = await postgresQueries.getErasWithLowTotalReward(postgres)
    equal(erasCountWithLowTotalReward, 0, `There is ${erasCountWithLowTotalReward} eras with low total rewards`)
  })

  it('Check eras for low total reward points', async () => {
    const erasCountWithLowTotalRewardPoints = await postgresQueries.getErasWithLowTotalRewardPoints(postgres)
    equal(erasCountWithLowTotalRewardPoints, 0, `There is ${erasCountWithLowTotalRewardPoints} eras with low total rewards points`)
  })

  it('Check related entities of eventsCount on node and eventCount on indexator by blockId', async () => {}).timeout(0)

  it('Check related entities of extrinsicCount on node and extrinsicCount on indexator by blockId', async () => {}).timeout(0)

  it('Check related entities of validatorsCount on node and validatorsCount on indexator by blockId', async () => {}).timeout(0)

  after(function () {
    postgres.end()
    substrateConnector.apiDisconnect()
  })
})

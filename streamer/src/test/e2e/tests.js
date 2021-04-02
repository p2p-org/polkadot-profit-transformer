const { equal } = require('assert')
const { environment } = require('../../environment')
const substrateConnector = require('../utils/substrateInterface')
const postgresConnector = require('../utils/postgres/postgres')
const postgresQueries = require('../utils/postgres/postgresQueries')

let nodeApi
let postgres

describe('Init', () => {
    before(async () => {
        try {
            postgres = postgresConnector.pool
            nodeApi = await substrateConnector.apiConnection()
        } catch (err) {
            console.log(err.stack)
            throw new Error(`Connection error`)
        }
    })

    it('Check for "chain" and "chainType"', async () => {
        const [currentChainRaw, currentChainTypeRaw] = await Promise.all([
            await nodeApi.rpc.system.chain(),
            await nodeApi.rpc.system.chainType()
        ])

        const currentChain = currentChainRaw.toString().trim()
        const currentChainType = currentChainTypeRaw.toString().trim()
        equal(currentChain, 'Polkadot')
        equal(currentChainType, 'Live')
    })

    it('Check streamer missed blocks', async () => {
        const missedBlocksCount = await postgresQueries.getMissedBlocksCount(postgres)
        equal(missedBlocksCount < 100, true, `Streamer has  ${missedBlocksCount} missed blocks`)
    })

    it('Check table eras for misses by validatorsCount in validators table', async () => {
        const missedValidators = await postgresQueries.getMissedValidators(postgres)
        equal(missedValidators.count, 0,
            `There is discrepancy between sum of validators_active in ${environment.DB_SCHEMA}.eras and count ` +
                    `of validators in ${environment.DB_SCHEMA}.validators for corresponding value of era; Eras : ${missedValidators.eras}`
        )
    })

    it('Check table eras for misses by nominatorsCount in nominators table', async () => {
        const missedNominators = await postgresQueries.getMissedNominators(postgres)
        equal(missedNominators.count, 0,
            `There is discrepancy between sum of nominators_active in ${environment.DB_SCHEMA}.eras and count ` +
                    `of nominators in ${environment.DB_SCHEMA}.nominators for corresponding value of era; Eras : ${missedNominators.eras}`
        )
    })

    it('Check missed hashes for sequence of blocks', async () => {
        const missedHashes = await postgresQueries.getMissedHashesForSequenceOfBlocks(postgres)
        equal(missedHashes.breakCount, 0,
            `There is ${missedHashes.breakCount} hashes sequence breaks; ` +
                    `Breaks info: ${JSON.stringify(missedHashes.info)}`
        )
    })

    it('Check node top block  with streamer top block', async () => {
        const topBlock = await postgresQueries.getTopBlock(postgres)
        const nodeTopBlock = await nodeApi.rpc.chain.getHeader()
        const topBlockDifference = nodeTopBlock.number.toString() - topBlock
        equal(topBlockDifference < 100, true,
            `Streamer top block is lag behind of node top block for ${topBlockDifference} blocks`)
    })

    it('Check eras for low total stake', async () => {
        const erasCountWithLowTotalStake = await postgresQueries.getErasWithLowTotalStack(postgres)
        equal(erasCountWithLowTotalStake.erasCount, 0,
            `There is ${erasCountWithLowTotalStake.eras} eras with low total stake`)
    })

    it('Check eras for low total reward', async () => {
        const erasCountWithLowTotalReward = await postgresQueries.getErasWithLowTotalReward(postgres)
        equal(erasCountWithLowTotalReward.erasCount, 0,
            `There is ${erasCountWithLowTotalReward.eras} eras with low total rewards`)
    })

    it('Check eras for low total reward points', async () => {
        const erasCountWithLowTotalRewardPoints = await postgresQueries.getErasWithLowTotalRewardPoints(postgres)
        equal(erasCountWithLowTotalRewardPoints.erasCount, 0,
            `There is ${erasCountWithLowTotalRewardPoints.eras} eras with low total rewards points`)
    })

    it('Check rewards points in eras and sum of reward points in validators by eras', async () => {
        const rewardPointsInconsistenciesEras = await postgresQueries.getErasWithRewardPointsInconsistencies(postgres)
        equal(JSON.stringify(rewardPointsInconsistenciesEras.erasCount), 0,
            `There is ${JSON.stringify(rewardPointsInconsistenciesEras.erasCount)} ` +
                    `eras count with incorrect reward_points sum in validators table;Eras : ` +
                    `${JSON.stringify(rewardPointsInconsistenciesEras.eras)} `
        )
    })

    // it('Check related entities of eventsCount on node and eventCount on indexator by blockId', async () => {}).timeout(0)
    //
    // it('Check related entities of extrinsicCount on node and extrinsicCount on indexator by blockId', async () => {}).timeout(0)
    //
    // it('Check related entities of validatorsCount on node and validatorsCount on indexator by blockId', async () => {}).timeout(0)

    after(function () {
        postgres.end()
        substrateConnector.apiDisconnect()
    })
})

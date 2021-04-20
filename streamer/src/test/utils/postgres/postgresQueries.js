const {environment} = require('../../../environment')
const DB_SCHEMA = environment.DB_SCHEMA
const totalStakeThreshold = 1000000
const totalRewardThreshold = 1000000
const totalRewardPointsThreshold = 20


async function getQuery(postgres, queryString) {
    let queryResult
    try {
        queryResult = await postgres.query(queryString)
    } catch (error) {
        console.log(error.stack)
        throw new Error(`Error executing query`)
    }
    return queryResult
}

async function getMissedBlocksCount(postgres) {
    const missedBlocksCount = await getQuery(postgres, `SELECT max(id)-count(*) as missedBlocks FROM ${DB_SCHEMA}.blocks`)
    return missedBlocksCount.rows[0].missedblocks
}

async function getTopBlock(postgres) {
    const topBlock = await getQuery(postgres, `SELECT max(id) as topBlock FROM ${DB_SCHEMA}.blocks`)
    return topBlock.rows[0].topblock
}

async function getMissedValidators(postgres) {
    const missedValidators = await getQuery(
        postgres,
        `SELECT era FROM( 
         SELECT ${DB_SCHEMA}.eras.era,count(${DB_SCHEMA}.validators.era) 
         FROM ${DB_SCHEMA}.validators 
         FULL OUTER JOIN ${DB_SCHEMA}.eras on ${DB_SCHEMA}.validators.era=${DB_SCHEMA}.eras.era
         GROUP BY ${DB_SCHEMA}.validators.era,${DB_SCHEMA}.eras.era 
         HAVING ${DB_SCHEMA}.eras.validators_active<>count(${DB_SCHEMA}.validators.era) 
        )t`
    )
    return {
        count: missedValidators.rowCount,
        eras: missedValidators.rows
    }
}

async function getMissedNominators(postgres) {
    const missedNominators = await getQuery(
        postgres,
        `SELECT era FROM(
         SELECT ${DB_SCHEMA}.eras.era,count(distinct ${DB_SCHEMA}.nominators.account_id)
         FROM ${DB_SCHEMA}.nominators
         FULL OUTER JOIN ${DB_SCHEMA}.eras on ${DB_SCHEMA}.nominators.era=${DB_SCHEMA}.eras.era
         GROUP BY ${DB_SCHEMA}.nominators.era,${DB_SCHEMA}.eras.era
         HAVING ${DB_SCHEMA}.eras.nominators_active<>count(distinct ${DB_SCHEMA}.nominators.account_id)
        )t`
    )
    return {
        count: missedNominators.rowCount,
        eras: missedNominators.rows
    }
}

async function getErasWithLowTotalStack(postgres) {
    const erasWithLowTotalStack = await getQuery(postgres, `SELECT era FROM ${DB_SCHEMA}.eras WHERE total_stake<${totalStakeThreshold}`)
    if (erasWithLowTotalStack.rows.length === 1 && erasWithLowTotalStack.rows[0].era === 0) {
        return {
            erasCount: 0
        }
    }
    return {
        erasCount: erasWithLowTotalStack.rows.length,
        eras: erasWithLowTotalStack.rows
    }
}

async function getErasWithLowTotalReward(postgres) {
    const erasWithLowTotalReward = await getQuery(postgres, `SELECT era FROM ${DB_SCHEMA}.eras WHERE total_reward<${totalRewardThreshold}`)
    if (erasWithLowTotalReward.rows.length === 1 && erasWithLowTotalReward.rows[0].era === 0) {
        return {
            erasCount: 0
        }
    }
    return {
        erasCount: erasWithLowTotalReward.rows.length,
        eras: erasWithLowTotalReward.rows
    }
}

async function getErasWithLowTotalRewardPoints(postgres) {
    const erasWithLowTotalRewardsPoints = await getQuery(postgres, `SELECT era FROM ${DB_SCHEMA}.eras WHERE total_reward_points<${totalRewardPointsThreshold}`)
    if (erasWithLowTotalRewardsPoints.rows.length === 1 && erasWithLowTotalRewardsPoints.rows[0].era === 0) {
        return {
            erasCount: 0
        }
    }
    return {
        erasCount: erasWithLowTotalRewardsPoints.rows.length,
        eras: erasWithLowTotalRewardsPoints.rows
    }
}

async function getMissedHashesForSequenceOfBlocks(postgres) {
    const missedHashes = await getQuery(
        postgres,
        `SELECT id,parent_hash, prv_id,Prv_hash
         FROM
        (SELECT id,parent_hash,
        Lag(hash) over (ORDER BY id) Prv_hash,
        Lag(id) over (ORDER BY id) prv_id
        FROM dot_polka.blocks) AS InnerQuery
        WHERE parent_hash<>Prv_hash 
        ORDER BY id`
    )
    return {
        breakCount: missedHashes.rows.length,
        info: missedHashes.rows
    }
}

async function getErasWithRewardPointsInconsistencies(postgres) {
    const inconsistencies = await getQuery(
        postgres,
        `SELECT era FROM(
         SELECT ${DB_SCHEMA}.eras.era,count( ${DB_SCHEMA}.nominators.era),${DB_SCHEMA}.eras.nominators_active 
         FROM ${DB_SCHEMA}.nominators 
         FULL OUTER JOIN ${DB_SCHEMA}.eras on ${DB_SCHEMA}.nominators.era=${DB_SCHEMA}.eras.era 
         GROUP BY ${DB_SCHEMA}.nominators.era,${DB_SCHEMA}.eras.era
         HAVING ${DB_SCHEMA}.eras.nominators_active<>count(${DB_SCHEMA}.nominators.era) or ${DB_SCHEMA}.eras.nominators_active is null
        )t`
    )
    return {
        erasCount: inconsistencies.rows.length,
        eras: inconsistencies.rows
    }
}

module.exports = {
    getTopBlock,
    getMissedBlocksCount,
    getMissedValidators,
    getMissedNominators,
    getErasWithLowTotalStack,
    getErasWithLowTotalReward,
    getErasWithLowTotalRewardPoints,
    getMissedHashesForSequenceOfBlocks,
    getErasWithRewardPointsInconsistencies
}

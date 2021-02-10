async function getQuery(postgres, queryString) {
  return await postgres
    .query(queryString)
    .catch((err) => {
      console.log(err.stack)
      throw new Error(`Error executing query`)
    })
    .then((res) => {
      return res
    })
}

async function getMissedBlocksCount(postgres) {
  const missedBlocksCount = await getQuery(postgres, 'select max(id)-count(*) as missedBlocks from dot_polka.blocks')
  return missedBlocksCount.rows[0].missedblocks
}

async function getTopBlock(postgres) {
  const topBlock = await getQuery(postgres, 'SELECT id FROM dot_polka.blocks ORDER BY id DESC LIMIT 1')
  return topBlock.rows[0].id
}

async function getMissedValidators(postgres) {
  const missedValidators = await getQuery(
    postgres,
    '\n' +
      'select era from(\n' +
      'select dot_polka.eras.era,count(dot_polka.validators.era)\n' +
      'from dot_polka.validators\n' +
      'FULL OUTER JOIN dot_polka.eras on dot_polka.validators.era=dot_polka.eras.era\n' +
      'group by dot_polka.validators.era,dot_polka.eras.era\n' +
      'HAVING dot_polka.eras.validators_active<>count(dot_polka.validators.era)\n' +
      ')t'
  )
  return missedValidators.rowCount
}

async function getMissedNominators(postgres) {
  const missedNominators = await getQuery(
    postgres,
    '\n' +
      'select era from(\n' +
      'select dot_polka.eras.era,count( dot_polka.nominators.era)\n' +
      'from dot_polka.nominators\n' +
      'FULL OUTER JOIN dot_polka.eras on dot_polka.nominators.era=dot_polka.eras.era\n' +
      'group by dot_polka.nominators.era,dot_polka.eras.era\n' +
      'HAVING dot_polka.eras.nominators_active<>count(dot_polka.nominators.era)\n' +
      ')t'
  )
  return missedNominators.rowCount
}

async function getErasWithLowTotalStack(postgres) {
  const erasWithLowTotalStack = await getQuery(postgres, 'select era from dot_polka.eras where total_stake<1000000')
  if (erasWithLowTotalStack.rows.length === 1 && erasWithLowTotalStack.rows[0].era === 0) {
    return 0
  }
  return erasWithLowTotalStack.rows.length
}

async function getErasWithLowTotalReward(postgres) {
  const erasWithLowTotalReward = await getQuery(postgres, 'select era from dot_polka.eras where total_reward<1000000')
  return erasWithLowTotalReward.rows.length
}

async function getErasWithLowTotalRewardPoints(postgres) {
  const erasWithLowTotalRewardsPoints = await getQuery(postgres, 'select era from dot_polka.eras where total_reward_points<20')
  return erasWithLowTotalRewardsPoints.rows.length
}

async function getMissedHashesForSequenceOfBlocks(postgres) {
  const missedHashes = await getQuery(
    postgres,
    'select id,parent_hash, prv_id,Prv_hash \n' +
      'FROM\n' +
      '    (select id,parent_hash,\n' +
      '    Lag(hash) over (order by id) Prv_hash,\n' +
      '    Lag(id) over (order by id) prv_id\n' +
      '    from dot_polka.blocks) AS InnerQuery\n' +
      '    where parent_hash<>Prv_hash\n' +
      '    order by id'
  )
  return {
    breakCount: missedHashes.rows.length,
    info: missedHashes.rows
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
  getMissedHashesForSequenceOfBlocks
}

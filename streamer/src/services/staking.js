const { KAFKA_PREFIX, DB_SCHEMA } = require('../environment')
const { BlocksService } = require('./blocks')

/** @type {BlockHash | string | Uint8Array} */
let currentSpecVersion = null

const attemptsCount = 5

// Declares era offset for extraction staking data for target era
const eraDataExtractionOffset = 4

/**
 * Provides era validators operations
 * @class
 */

// TODO: Rename to stacking
class StakingService {
  /**
   * Creates an instance of StakingService.
   * @param {object} app fastify app
   */
  constructor(app) {
    if (!app.ready) throw new Error(`can't get .ready from fastify app.`)

    /** @private */
    this.app = app

    const { polkadotConnector } = this.app

    if (!polkadotConnector) {
      throw new Error('cant get .polkadotConnector from fastify app.')
    }

    /** @type {u32} */
    this.currentSpecVersion = polkadotConnector.createType('u32', 0)

    const { kafkaProducer } = this.app

    if (!kafkaProducer) {
      throw new Error('cant get .kafkaProducer from fastify app.')
    }

    const { postgresConnector } = this.app

    if (!postgresConnector) {
      throw new Error('cant get .postgresConnector from fastify app.')
    }

    postgresConnector.connect((err, client, release) => {
      if (err) {
        this.app.log.error(`Error acquiring client: ${err.toString()}`)
        throw new Error(`Error acquiring client`)
      }
      client.query('SELECT NOW()', (err, result) => {
        release()
        if (err) {
          this.app.log.error(`Error executing query: ${err.toString()}`)
          throw new Error(`Error executing query`)
        }
      })
    })
  }

  async syncValidators(era) {
    try {

      if (era == null) {
        era = 0
      }

      const lastAvailableEra =  await this.getLastEraFromDB()

      const lastDataExtractionAvailableEra = lastAvailableEra - eraDataExtractionOffset

      this.app.log.info(`Starting processBlocks for block era: ${era} - ${lastAvailableEra}`)

      if (lastDataExtractionAvailableEra <= era ) {
        this.app.log.error(`Last block era reached from ${era} to ${lastAvailableEra}.`)
        return
      }

      while (era <= lastDataExtractionAvailableEra) {
        for (let attempts = attemptsCount; attempts > 0; attempts--) {
          let lastError = null
          const extractionBlock = await this.getFirstBlockFromDB(era + eraDataExtractionOffset, attemptsCount - attempts)

          if (extractionBlock.id === 0 && era > 0) {
            throw new Error('cannot get first era block number')
          }

          await this.extractStakers(era, extractionBlock).catch((error) => {
            lastError = error
            this.app.log.error(`failed to process stakers block #${extractionBlock}: ${error}`)
          })

          if (!lastError) {
            era++
            break
          }

          await this.sleep(2000)
        }
      }
    } finally {
    }
  }


  /**
   *
   * @param {number} era
   * @param {BlockOffsetInfo} blockData
   */
  async extractStakers(era, blockData) {
    const { polkadotConnector } = this.app
    const { kafkaProducer } = this.app

    this.app.log.info(`Processing stacking data for era "${era}"`)

    await this.updateMetaData(blockData.hash)

    const [currentEra, sessionId, blockTime] = await Promise.all([
      polkadotConnector.query.staking.currentEra(),
      polkadotConnector.query.session.currentIndex.at(blockData.hash),
      polkadotConnector.query.timestamp.now.at(blockData.hash)
    ])

    const historyDepth = await polkadotConnector.query.staking.historyDepth.at(blockData.hash)
    if (currentEra.unwrap().toNumber() - era > historyDepth.toNumber()) {
      this.app.log.warn(`The block height less than HISTORY_DEPTH value: ${historyDepth.toNumber()}`)
    }

    const stakingData = await this.getValidators(blockData.hash, sessionId, blockTime, era)

    await kafkaProducer
      .send({
        topic: KAFKA_PREFIX + '_STAKING_ERAS_DATA',
        messages: [
          {
            key: stakingData.era_data.era.toString(),
            value: JSON.stringify(stakingData.era_data)
          }
        ]
      })
      .catch((error) => {
        this.app.log.error(`failed to push era data: `, error)
        throw new Error('cannot push session data to Kafka')
      })

    await kafkaProducer
      .send({
        topic: KAFKA_PREFIX + '_SESSION_DATA',
        messages: [
          {
            // key: blockData.block.header.number.toString(),
            value: JSON.stringify({
              session_id: sessionId.toNumber(),
              era: parseInt(era.toString(), 10),
              block_end: null,
              validators: stakingData.validators,
              nominators: stakingData.nominators,
              block_time: blockTime.toNumber()
            })
          }
        ]
      })
      .catch((error) => {
        this.app.log.error(`failed to push session data: `, error)
        throw new Error('cannot push session data to Kafka')
      })
  }

  /**
   * Validators and stakers options
   *
   * @typedef {Object} ValidatorsResult
   * @property {Array<Object>} validators
   * @property {Array<Object>} nominators
   * @property {Object} era_data
   */

  /**
   *
   *
   * @param {number} blockEra
   * @returns {Promise<ValidatorsResult>}
   */
  async getValidators(blockHash, sessionId, blockTime, blockEra) {
    const { polkadotConnector } = this.app

    const result = {
      validators: [],
      stakers: [],
      era_data: {
        era: parseInt(blockEra.toString(), 10),
        session_start: 0,
        validators_active: 0,
        nominators_active: 0,
        total_reward: '0',
        total_stake: '0',
        total_reward_points: 0
      }
    }

    this.app.log.debug(`[validators][getValidators] Block: "${blockHash}"`)

    const [sessionStart, totalStake, totalReward] = await Promise.all([
      polkadotConnector.query.staking.erasStartSessionIndex.at(blockHash, blockEra),
      polkadotConnector.query.staking.erasTotalStake.at(blockHash, blockEra),
      polkadotConnector.query.staking.erasValidatorReward.at(blockHash, blockEra) // TODO: change to .at query
    ])

    result.era_data.session_start = parseInt(sessionStart.toString(), 10)
    result.era_data.total_stake = totalStake.toString()
    result.era_data.total_reward = !totalReward.isNone ? totalReward.unwrap().toString() : 0


    const [validators, disabledValidatorsVec,  erasRewardPointsRaw] = await Promise.all([
      polkadotConnector.query.session.validators.at(blockHash),
      polkadotConnector.query.session.disabledValidators.at(blockHash),
      polkadotConnector.query.staking.erasRewardPoints.at(blockHash, blockEra) // !!!
    ])

    /** @type {Array<u32>} */
    const disabledValidators = disabledValidatorsVec.map((i) => validators[i.toNumber()]);

    /** @type {Array<u32>} */
    const enabledValidators = validators.filter(function(item){
      return disabledValidators.indexOf(item) === -1;
    })

    result.era_data.validators_active = enabledValidators.length
    result.era_data.total_reward_points = parseInt(erasRewardPointsRaw.total.toString(), 10)

    this.app.log.debug(
      `[validators][getValidators] Loaded validators: enabled=${enabledValidators.length.toString()}, disabled=${disabledValidators.length.toString()} for era "${blockEra.toString()}"`
    )

    // TODO: !!!! Check query.staking.ledger
    if (!validators.length) {
      return result
    }

    // Prepare reward points
    const erasRewardPointsMap = {}
    erasRewardPointsRaw.individual.forEach((rewardPoints, accountId) => {
      erasRewardPointsMap[accountId.toString()] = rewardPoints.toNumber()
    })


    const enabledValidatorsData = await this.getStakersByValidator(blockHash, sessionId, blockTime, blockEra, erasRewardPointsMap, enabledValidators, true)
    const disabledValidatorsData = await this.getStakersByValidator(blockHash, sessionId, blockTime, blockEra, erasRewardPointsMap, disabledValidators, false)

    result.validators = enabledValidatorsData.validators.concat(disabledValidatorsData.validators)
    result.nominators = enabledValidatorsData.nominators.concat(disabledValidatorsData.nominators)
    result.era_data.nominators_active = result.nominators_active

    return result
  }

  async getStakersByValidator(blockHash, sessionId, blockTime, blockEra, erasRewardPointsMap, validators, isEnabled) {
    const { polkadotConnector } = this.app

    let result = {
      validators: [],
      nominators: [],
      nominators_active: 0
    }

    for (const validator of validators) {
      try {
        const [prefs, stakers, stakersClipped] = await Promise.all([
          await polkadotConnector.query.staking.erasValidatorPrefs.at(blockHash, blockEra.toString(), validator.toString()),
          await polkadotConnector.query.staking.erasStakers.at(blockHash, blockEra.toString(), validator.toString()),
          await polkadotConnector.query.staking.erasStakersClipped.at(blockHash, blockEra.toString(), validator.toString())
        ])

        this.app.log.debug(`[validators][getStakersByValidator] Loaded stakers: ${stakers.others.length} for validator "${validator.toString()}"`)

        for (const staker of stakers.others) {
          try {
            const isClipped = stakersClipped.others.find((e) => {
              return e.who.toString() === staker.who.toString()
            })

            result.nominators_active++

            const stakerEntry = {
              account_id: staker.who.toString(),
              era: parseInt(blockEra.toString(), 10),
              session_id: sessionId.toNumber(),
              validator: validator.toString(),
              is_enabled: true,
              is_clipped: !isClipped,
              value: staker.value.toString(),
              block_time: blockTime.toNumber()
            }

            // Only for active
            // if (isOnlyActiveValidators) {
            const payee = await polkadotConnector.query.staking.payee.at(blockHash, staker.who.toString())
            if (payee) {
              if (!payee.isAccount) {
                stakerEntry.reward_dest = payee.toString()
              } else {
                stakerEntry.reward_dest = 'Account'
                stakerEntry.reward_account_id = payee.asAccount
              }
            }
            // }
            result.nominators.push(stakerEntry)
          } catch (e) {
            this.app.log.error(`[validators][getValidators] Cannot process staker: ${staker.who.toString()} "${e.toString()}". Block: ${blockHash}`)
          }
        }

        // TODO: Check for duplicates in nominators
        // TODO: Load ledger data

        let { validatorRewardDest, validatorRewardAccountId } = [null, null]

        const validatorPayee = await polkadotConnector.query.staking.payee.at(blockHash, validator.toString())
        if (validatorPayee) {
          if (!validatorPayee.isAccount) {
            validatorRewardDest = validatorPayee.toString()
          } else {
            validatorRewardDest = 'Account'
            validatorRewardAccountId = validatorPayee.asAccount
          }
        } else {
          this.app.log.warn(`failed to get payee for era: "${blockEra.toString()}" validator: "${validator.toString()}". Block: ${blockHash} `)
        }

        result.validators.push({
          session_id: sessionId.toNumber(),
          account_id: validator.toString(),
          era: parseInt(blockEra.toString(), 10),
          is_enabled: isEnabled,
          total: stakers.total.toString(),
          own: stakers.own.toString(),
          nominators_count: stakers.others.length,
          reward_points: erasRewardPointsMap[validator.toString()] ? erasRewardPointsMap[validator.toString()] : 0,
          reward_dest: validatorRewardDest,
          reward_account_id: validatorRewardAccountId,
          prefs: prefs.toJSON(),
          block_time: blockTime.toNumber()
        })
      } catch (e) {
        this.app.log.error(
            `[validators][getStakersByValidator] Cannot get validator data: account_id="${validator.toString()}" "${e.toString()}". Block: ${blockHash}`
        )
      }
    }

    return result
  }

  /**
   * Block short description
   *
   * @typedef {Object} BlockOffsetInfo
   * @property {number} id
   * @property {number} hash
   */

  /**
   *
   *
   * @param {number} era
   * @param {number} offset
   * @returns {Promise<BlockOffsetInfo>}
   */
  async getFirstBlockFromDB(era, offset = 0) {
    const { postgresConnector } = this.app
    let blockNumber = 0
    let blockHash = 0
    await postgresConnector
      .query({
        text: `SELECT "id", "hash" FROM ${DB_SCHEMA}.blocks WHERE "era" > $1 ORDER BY "id" ASC LIMIT 1 OFFSET $2`,
        values: [era, offset]
      })
      .then((res) => {
        if (res.rows.length) {
          blockNumber = res.rows[0].id
          blockHash = res.rows[0].hash
        }
      })
      .catch((err) => {
        this.app.log.error(`[getFirstBlockFromDB] failed to get first synchronized era block number: ${err}`)
        throw new Error('cannot get first era block number')
      })

    return { id: blockNumber, hash: blockHash }
  }

  async getLastEraFromDB() {
    const { postgresConnector } = this.app
    let era = 0

    await postgresConnector
        .query({
          text: `SELECT "era" FROM ${DB_SCHEMA}.blocks ORDER BY "id" DESC LIMIT 1`
        })
        .then((res) => {
          if (res.rows.length) {
            era = res.rows[0].era
          }
        })
        .catch((err) => {
          this.app.log.error(`[getLastEraFromDB] failed to get first synchronized era block number: ${err}`)
          throw new Error('cannot get first era block number')
        })

    return era
  }

  /**
   * Update specs version metadata
   *
   * @private
   * @async
   * @param {BlockHash} blockHash - The block hash
   */
  async updateMetaData(blockHash) {
    const { polkadotConnector } = this.app

    /** @type {RuntimeVersion} */
    const runtimeVersion = await polkadotConnector.rpc.state.getRuntimeVersion(blockHash)

    /** @type {u32} */
    const newSpecVersion = runtimeVersion.specVersion

    if (newSpecVersion.gt(this.currentSpecVersion)) {
      this.app.log.info(`bumped spec version to ${newSpecVersion}, fetching new metadata`)

      const rpcMeta = await polkadotConnector.rpc.state.getMetadata(blockHash)

      currentSpecVersion = newSpecVersion

      polkadotConnector.registry.setMetadata(rpcMeta)
    }
  }

  /**
   *
   * @param {number} ms
   * @returns {Promise<>}
   */
  async sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms)
    })
  }
}

/**
 *
 * @type {{StakingService: StakingService}}
 */
module.exports = {
  StakingService: StakingService
}

const { KAFKA_PREFIX, DB_SCHEMA } = require('../environment')

/** @type {BlockHash | string | Uint8Array} */
let currentSpecVersion = null

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

  async syncValidators(blockEra) {
    let blockNumber = 0
    try {
      this.app.log.info(`Starting processBlocks`)

      if (blockEra == null) {
        blockEra = -1
      }

      const res = await this.getNextEraBlockFromDB(blockEra)
      blockNumber = res.id
      blockEra = res.era

      const lastBlockEra = 300 // await this.blocksService.getFinBlockNumber()

      this.app.log.info(`Processing staker data from ${blockNumber} to head:`)

      console.log(blockEra)

      while (blockEra <= lastBlockEra) {
        for (let attempts = 3; attempts > 0; attempts--) {
          let lastError = null
          await this.extractStakers(blockNumber).catch((error) => {
            lastError = error
            this.app.log.error(`failed to process stakers block #${blockNumber}: ${error}`)
          })

          if (!lastError || attempts === 1) {
            const res = await this.getNextEraBlockFromDB(blockEra)
            blockNumber = res.id
            blockEra = res.era
            break
          }

          await this.sleep(2000)
        }
      }
    } finally {
    }
  }

  async extractStakers(blockNumber) {
    const { polkadotConnector } = this.app
    const { kafkaProducer } = this.app

    const blockHash = await polkadotConnector.rpc.chain.getBlockHash(blockNumber)

    if (!blockHash) {
      throw new Error('cannot get block hash')
    }

    await this.updateMetaData(blockHash)

    const [currentEra, sessionId, blockEraRaw, blockTime] = await Promise.all([
      polkadotConnector.query.staking.currentEra(),
      polkadotConnector.query.session.currentIndex.at(blockHash),
      polkadotConnector.query.staking.activeEra.at(blockHash),
      polkadotConnector.query.timestamp.now.at(blockHash)
    ])

    if (blockEraRaw.isNone) {
      throw new Error(`era not found for block hash: ${blockHash.toString()}`)
    }

    const blockEra = blockEraRaw.unwrap().index.toNumber()

    const historyDepth = await polkadotConnector.query.staking.historyDepth.at(blockHash)
    if (currentEra.unwrap().toNumber() - blockEra > historyDepth.toNumber()) {
      this.app.log.warn(`The block height less than HISTORY_DEPTH value: ${historyDepth.toNumber()}`)
    }

    const [stakersEnabled, stakersDisabled] = await Promise.all([
      this.getValidators(blockHash, sessionId, blockTime, blockEra),
      this.getValidators(blockHash, sessionId, blockTime, blockEra, false)
    ])

    await kafkaProducer
      .send({
        topic: KAFKA_PREFIX + '_STAKING_ERAS_DATA',
        messages: [
          {
            key: stakersEnabled.era_data.era.toString(),
            value: JSON.stringify(stakersEnabled.era_data)
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
              era: parseInt(blockEra.toString(), 10),
              block_end: null,
              validators: stakersEnabled.validators.concat(stakersDisabled.validators),
              nominators: stakersEnabled.stakers.concat(stakersDisabled.stakers),
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
   * @property {Array<Object>} stakers
   * @property {Object} era_data
   */

  /**
   *
   *
   * @param {number} blockEra
   * @returns {Promise<ValidatorsResult>}
   */
  async getValidators(blockHash, sessionId, blockTime, blockEra, isOnlyActiveValidators = true) {
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

    if (isOnlyActiveValidators) {
      const [sessionStart, totalStake, totalReward] = await Promise.all([
        polkadotConnector.query.staking.erasStartSessionIndex.at(blockHash, blockEra),
        polkadotConnector.query.staking.erasTotalStake.at(blockHash, blockEra),
        polkadotConnector.query.staking.erasValidatorReward.at(blockHash, blockEra) // TODO: change to .at query
      ])

      result.era_data.session_start = parseInt(sessionStart.toString(), 10)
      result.era_data.total_stake = totalStake.toString()
      result.era_data.total_reward = !totalReward.isNone ? totalReward.unwrap().toString() : 0
    }

    let { validators, erasRewardPointsRaw } = [[], []]

    if (isOnlyActiveValidators) {
      ;[validators, erasRewardPointsRaw] = await Promise.all([
        polkadotConnector.query.session.validators.at(blockHash),
        polkadotConnector.query.staking.erasRewardPoints.at(blockHash, blockEra) // !!!
      ])

      result.era_data.total_reward_points = parseInt(erasRewardPointsRaw.total.toString(), 10)

      this.app.log.debug(
        `[validators][getValidators] Loaded enabled validators: ${validators.length.toString()} for era "${blockEra.toString()}"`
      )
    } else {
      validators = await polkadotConnector.query.session.disabledValidators.at(blockHash)
      this.app.log.debug(
        `[validators][getValidators] Loaded disabled validators: ${validators.length.toString()} for era "${blockEra.toString()}"`
      )
    }

    // TODO: !!!! Check query.staking.ledger
    if (!validators.length) {
      return result
    }

    const erasRewardPointsMap = {}
    if (isOnlyActiveValidators) {
      erasRewardPointsRaw.individual.forEach((rewardPoints, accountId) => {
        erasRewardPointsMap[accountId.toString()] = rewardPoints.toNumber()
      })
    }

    if (isOnlyActiveValidators) {
      result.era_data.validators_active += validators.length
    }

    // erasValidatorReward
    for (const validator of validators) {
      try {
        const [prefs, stakers, stakersClipped] = await Promise.all([
          await polkadotConnector.query.staking.erasValidatorPrefs.at(blockHash, blockEra.toString(), validator.toString()),
          await polkadotConnector.query.staking.erasStakers.at(blockHash, blockEra.toString(), validator.toString()),
          await polkadotConnector.query.staking.erasStakersClipped.at(blockHash, blockEra.toString(), validator.toString())
        ])

        this.app.log.debug(`[validators][getValidators] Loaded stakers: ${stakers.others.length} for validator "${validator.toString()}"`)

        for (const staker of stakers.others) {
          try {
            const isClipped = stakersClipped.others.find((e) => {
              return e.who.toString() === staker.who.toString()
            })

            if (isOnlyActiveValidators) {
              result.era_data.nominators_active++
            }
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
            if (isOnlyActiveValidators) {
              const payee = await polkadotConnector.query.staking.payee.at(blockHash, staker.who.toString())
              if (payee) {
                if (!payee.isAccount) {
                  stakerEntry.reward_dest = payee.toString()
                } else {
                  stakerEntry.reward_dest = 'Account'
                  stakerEntry.reward_account_id = payee.asAccount
                }
              }
            }
            result.stakers.push(stakerEntry)
          } catch (e) {
            this.app.log.error(`[validators][getValidators] Cannot process staker: ${staker.who.toString()} "${e.toString()}"`)
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
          this.app.log.warn(`failed to get payee for era: "${blockEra.toString()}" validator: "${validator.toString()}" `)
        }

        result.validators.push({
          session_id: sessionId.toNumber(),
          account_id: validator.toString(),
          era: parseInt(blockEra.toString(), 10),
          is_enabled: isOnlyActiveValidators,
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
        if (isOnlyActiveValidators) {
          // eslint-disable-next-line max-len
          this.app.log.error(
            `[validators][getValidators(ACTIVE)] Cannot get validator data: account_id="${validator.toString()}" "${e.toString()}"`
          )
        } else {
          // eslint-disable-next-line max-len
          this.app.log.error(
            `[validators][getValidators(DISABLED)] Cannot get validator data: account_id="${validator.toString()}" "${e.toString()}"`
          )
        }
      }
    }
    console.log(result.era_data)
    return result
  }

  async getNextEraBlockFromDB(blockEra) {
    const { postgresConnector } = this.app
    let id = 0
    let era = 0

    await postgresConnector
      .query({
        text: `SELECT "id", "era" FROM ${DB_SCHEMA}.blocks WHERE "era" > $1 ORDER BY "id" ASC LIMIT 1`,
        values: [blockEra]
      })
      .then((res) => {
        if (res.rows.length) {
          id = res.rows[0].id
          era = res.rows[0].era
        }
      })
      .catch((err) => {
        this.app.log.error(`failed to get first synchronized era block number: ${err}`)
        throw new Error('cannot get first era block number')
      })

    return { id: id, era: era }
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

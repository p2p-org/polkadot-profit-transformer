const { BlocksService } = require('./blocks')

/** @type {BlockHash | string | Uint8Array} */
let currentSpecVersion = null

/**
 * Provides era validators operations
 * @class
 */
class ValidatorsService {
  /**
   * Creates an instance of ValidatorsService.
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
        throw new Error('Error acquiring client')
      }
      client.query('SELECT NOW()', (err, result) => {
        release()
        if (err) {
          throw new Error('Error executing query ' + err.toString())
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

      const lastBlockEra = 200 // await this.blocksService.getFinBlockNumber()

      this.app.log.info(`Processing staker data from ${blockNumber} to head:`)

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
            console.log(res.era)
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

    // await this.updateMetaData(blockHash)

    const [sessionId, blockEraRaw, blockTime] = await Promise.all([
      polkadotConnector.query.session.currentIndex.at(blockHash),
      polkadotConnector.query.staking.activeEra.at(blockHash),
      polkadotConnector.query.timestamp.now.at(blockHash)
    ])

    if (blockEraRaw.isNone) {
      throw new Error(`era not found for block hash: ${blockHash.toString()}`)
    }

    const blockEra = blockEraRaw.unwrap().index.toNumber()

    const [stakersEnabled, stakersDisabled] = await Promise.all([
      this.getValidators(blockHash, sessionId, blockTime, blockEra),
      this.getValidators(blockHash, sessionId, blockTime, blockEra, false)
    ])

    await kafkaProducer
      .send({
        topic: 'session_data',
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
   * Validators and stekers options
   *
   * @typedef {Object} ValidatorsResult
   * @property {Array<Object>} validators
   * @property {Array<Object>} stakers
   */

  /**
   *
   *
   * @param {number} blockEra
   * @returns {Promise<ValidatorsResult>}
   */
  async getValidators(blockHash, sessionId, blockTime, blockEra, activeValidators = true) {
    const { polkadotConnector } = this.app

    const result = {
      validators: [],
      stakers: []
    }

    let { validators, erasRewardPointsRaw } = [[], []]

    if (activeValidators) {
      ;[validators, erasRewardPointsRaw] = await Promise.all([
        polkadotConnector.query.session.validators.at(blockHash),
        polkadotConnector.query.staking.erasRewardPoints.at(blockHash, blockEra)
      ])

      this.app.log.debug(
        `[validators][getValidators] Loaded enabled validators: ${validators.length.toString()} for era "${blockEra.toString()}"`
      )
    } else {
      validators = await polkadotConnector.query.session.disabledValidators.at(blockHash)
      this.app.log.debug(
        `[validators][getValidators] Loaded disabled validators: ${validators.length.toString()} for era "${blockEra.toString()}"`
      )
    }

    if (!validators.length) {
      return result
    }

    const erasRewardPointsMap = {}
    if (activeValidators) {
      erasRewardPointsRaw.individual.forEach((rewardPoints, accountId) => {
        erasRewardPointsMap[accountId.toString()] = rewardPoints.toNumber()
      })
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
            if (activeValidators) {
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
          is_enabled: activeValidators,
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
        this.app.log.error(`[validators][getValidators] Cannot get validator data: ${validator.toString()} "${e.toString()}"`)
      }
    }

    return result
  }

  async getNextEraBlockFromDB(blockEra) {
    const { postgresConnector } = this.app
    let id = 0
    let era = 0

    await postgresConnector
      .query({
        text: 'SELECT "id", "era" FROM dot_polka.blocks WHERE "era" > $1 ORDER BY "id" ASC LIMIT 1',
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
 * @type {{ValidatorsService: ValidatorsService}}
 */
module.exports = {
  ValidatorsService: ValidatorsService
}

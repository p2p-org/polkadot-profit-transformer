const { SyncStatus } = require('./index')

/** @type {BlockHash | string | Uint8Array} */
let currentSpecVersion = null

/**
 * Provides block operations
 * @class
 */
class BlocksService {
  /**
   * Creates an instance of BlocksService.
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

    const { kafkaConnector } = this.app

    if (!kafkaConnector) {
      throw new Error('cant get .kafkaConnector from fastify app.')
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

  /**
   * Update one block
   *
   * @public
   * @async
   * @param {number} blockNumber
   * @returns {Promise<boolean>}
   */
  async updateOneBlock(blockNumber) {
    if (SyncStatus.isLocked()) {
      this.app.log.error(`failed execute "updateOneBlock": sync in process`)
      throw new Error('sync in process')
    }

    await this.processBlock(blockNumber).catch((error) => {
      this.app.log.error(`failed to process block #${blockNumber}: ${error}`)
      throw new Error('cannot process block')
    })
    return true
  }

  /* const chainType = await polkadotConnector.rpc.system.chainType()
    const chainName = await polkadotConnector.rpc.system.name()
    const nodeMethods = await polkadotConnector.rpc.rpc.methods()

    console.log(chainType.toString()) // Live
    console.log(chainName.toString()) //  Parity Polkadot
    */

  /**
   * Update one block
   *
   * @private
   * @async
   * @param {number} height
   * @param {BlockHash} blockHash
   * @returns {Promise}
   */
  async processBlock(height, blockHash = null) {
    const { polkadotConnector } = this.app

    if (blockHash == null) {
      if (height == null) {
        throw new Error('empty height and blockHash')
      }

      blockHash = await polkadotConnector.rpc.chain.getBlockHash(height)

      if (!blockHash) {
        throw new Error('cannot get block hash')
      }
    }

    // Check is this required
    // await this.updateMetaData(blockHash)

    const [sessionId, blockEra, signedBlock, extHeader, events] = await Promise.all([
      polkadotConnector.query.session.currentIndex.at(blockHash),
      polkadotConnector.query.staking.currentEra.at(blockHash),
      polkadotConnector.rpc.chain.getBlock(blockHash),
      polkadotConnector.derive.chain.getHeader(blockHash),
      polkadotConnector.query.system.events.at(blockHash)
    ])

    let blockEvents = []
    if (events.length) {
      blockEvents = await this.processEvents(signedBlock.block.header.number, events)
    }

    if (!signedBlock) {
      throw new Error('cannot get block')
    }

    const extrinsics = []

    signedBlock.block.extrinsics.forEach((extrinsic, exIndex) => {
      const referencedEventsIds = events
        .filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(exIndex))
        .map(({ event }, evIndex) => `${signedBlock.block.header.number}-${evIndex}`)

      extrinsics.push({
        id: `${signedBlock.block.header.number}-${exIndex}`,
        block_id: signedBlock.block.header.number,
        section: extrinsic.method.section,
        method: extrinsic.method.method,
        ref_event_ids: referencedEventsIds.length > 0 ? `{${referencedEventsIds.map((value) => `"${value}"`).join(',')}}` : null,
        extrinsic: extrinsic.toHuman()
      })
    })

    const lastDigestLogEntry = signedBlock.block.header.digest.logs.length - 1

    const blockData = {
      block: {
        header: {
          number: signedBlock.block.header.number.toNumber(),
          hash: signedBlock.block.header.hash.toHex(),
          author: extHeader.author.toString(),
          session_id: sessionId.toNumber(),
          era: parseInt(blockEra.toString(), 10),
          stateRoot: signedBlock.block.header.stateRoot.toHex(),
          extrinsicsRoot: signedBlock.block.header.extrinsicsRoot.toHex(),
          parentHash: signedBlock.block.header.parentHash.toHex(),
          last_log: lastDigestLogEntry > -1 ? signedBlock.block.header.digest.logs[lastDigestLogEntry].type : '',
          digest: signedBlock.block.header.digest.toString()
        }
      },
      extrinsics: [...extrinsics],
      events: blockEvents
    }

    this.app.log.info(`Process block "${blockData.block.header.number}" with hash ${blockData.block.header.hash}`)

    const { kafkaConnector } = this.app

    await kafkaConnector
      .send({
        topic: 'block_data',
        messages: [
          {
            key: blockData.block.header.number.toString(),
            value: JSON.stringify(blockData)
          }
        ]
      })
      .catch((error) => {
        this.app.log.error(`failed to push block: `, error)
        throw new Error('cannot push block to Kafka')
      })
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
   * Process all blocks with head
   *
   * @public
   * @async
   * @param startBlockNumber
   * @returns {Promise<void>}
   */
  async processBlocks(startBlockNumber = null) {
    await SyncStatus.acquire()

    try {
      this.app.log.info(`Starting processBlocks`)

      if (startBlockNumber == null) {
        startBlockNumber = await this.getLastProcessedBlock()
      }

      let lastBlockNumber = await this.getFinBlockNumber()

      this.app.log.info(`Processing blocks from ${startBlockNumber} to head: ${lastBlockNumber}`)

      for (let i = startBlockNumber + 1; i <= lastBlockNumber; i++) {
        for (let attempts = 5; attempts > 0; attempts--) {
          let lastError = null
          await this.processBlock(i).catch((error) => {
            lastError = error
            this.app.log.error(`failed to process block #${i}: ${error}`)
          })

          if (!lastError) {
            break
          }

          await this.sleep(2000)
        }

        if (i === lastBlockNumber) {
          lastBlockNumber = await this.getFinBlockNumber()
        }
      }
    } finally {
      // Please read and understand the WARNING above before using this API.
      SyncStatus.release()
    }
  }

  /**
   * Returns last processed block number from database
   *
   * @public
   * @async
   * @returns {Promise<number>}
   */
  async getLastProcessedBlock() {
    const { postgresConnector } = this.app

    let blockNumberFromDB = 0

    await postgresConnector
      .query('SELECT max("id") as last_number FROM dot_polka.blocks')
      .then((res) => {
        blockNumberFromDB = res.rows[0].last_number
      })
      .catch((err) => {
        this.app.log.error(`failed to get last synchronized block number: ${err}`)
        throw new Error('cannot get last block number')
      })

    return blockNumberFromDB
  }

  async getFinBlockNumber() {
    const { polkadotConnector } = this.app

    const lastFinHeader = await polkadotConnector.rpc.chain.getFinalizedHead()
    const lastFinBlock = await polkadotConnector.rpc.chain.getBlock(lastFinHeader)

    return lastFinBlock.block.header.number.toNumber()
  }

  /**
   * Synchronization status
   *
   * @typedef {Object} SyncSimpleStatus
   * @property {string} status
   * @property {number} fin_height_diff
   * @property {number} height_diff
   */

  /**
   *  Returns synchronization status, and diff between head and finalized head
   *
   * @public
   * @async
   * @returns {Promise<SyncSimpleStatus>}
   */
  async getBlocksStatus() {
    const { polkadotConnector } = this.app

    const result = {
      status: 'undefined',
      height_diff: -1,
      fin_height_diff: -1
    }

    if (SyncStatus.isLocked()) {
      result.status = 'synchronization'
    } else {
      result.status = 'synchronized'
    }

    try {
      const lastBlockNumber = await this.getFinBlockNumber()
      const lastHeader = await polkadotConnector.rpc.chain.getHeader()
      const lastLocalNumber = await this.getLastProcessedBlock()

      result.height_diff = lastBlockNumber - lastLocalNumber
      result.fin_height_diff = lastHeader.number.toNumber() - lastBlockNumber
    } catch (err) {
      this.app.log.error(`failed to get block diff: ${err}`)
    }

    return result
  }

  /**
   * Remove blocks data from database by numbers
   *
   * @public
   * @async
   * @param {number[]} blockNumbers
   * @returns {Promise<{result: boolean}>}
   */
  async removeBlocks(blockNumbers) {
    const { postgresConnector } = this.app

    postgresConnector.connect((err, client, release) => {
      if (err) {
        this.app.log.error(`failed to remove block from table: ${err}`)
        throw new Error('cannot remove blocks')
      }

      client.query(
        {
          text: 'DELETE FROM "dot_polka.blocks" WHERE "id" = ANY($1::int[])',
          values: [blockNumbers]
        },
        (err, result) => {
          release()
          if (err) {
            this.app.log.error(`failed to remove block from table: ${err}`)
            throw new Error('cannot remove blocks')
          }
        }
      )
    })

    for (const tbl of ['dot_polka.balances', 'dot_polka.events', 'dot_polka.extrinsics']) {
      postgresConnector.connect((err, client, release) => {
        if (err) {
          this.app.log.error(`failed to remove block from table "${tbl}": ${err}`)
          throw new Error('cannot remove blocks')
        }

        client.query(
          {
            text: `DELETE FROM "${tbl}" WHERE "block_id" = ANY($1::int[])`,
            values: [blockNumbers]
          },
          (err, result) => {
            release()
            if (err) {
              this.app.log.error(`failed to remove block from table "${tbl}": ${err}`)
              throw new Error('cannot remove blocks')
            }
          }
        )
      })
    }
    return { result: true }
  }

  /**
   * Remove blocks data from database from start
   *
   * @async
   * @private
   * @param {number} startBlockNumber
   * @returns {Promise<void>}
   */
  async trimBlocks(startBlockNumber) {
    const { postgresConnector } = this.app

    postgresConnector.connect((err, client, release) => {
      if (err) {
        this.app.log.error(`failed to remove block from table: ${err}`)
        throw new Error('cannot remove blocks')
      }

      client.query(
        {
          text: 'DELETE FROM "dot_polka.blocks" WHERE "id" >= $1::int',
          values: [startBlockNumber]
        },
        (err, result) => {
          release()
          if (err) {
            this.app.log.error(`failed to remove blocks from table: ${err}`)
            throw new Error('cannot remove blocks')
          }
        }
      )
    })

    for (const tbl of ['dot_polka.balances', 'dot_polka.events', 'dot_polka.extrinsics']) {
      postgresConnector.connect((err, client, release) => {
        if (err) {
          this.app.log.error(`failed to remove blocks from table "${tbl}": ${err}`)
          throw new Error('cannot remove blocks')
        }

        client.query(
          {
            text: `DELETE FROM "${tbl}" WHERE "id" >= $1::int`,
            values: [startBlockNumber]
          },
          (err, result) => {
            release()
            if (err) {
              this.app.log.error(`failed to remove blocks from table "${tbl}": ${err}`)
              throw new Error('cannot remove blocks')
            }
          }
        )
      })
    }
  }

  /**
   * Trim last blocks and update up to finalized head
   *
   * @param {number} startBlockNumber
   * @returns {Promise<{result: boolean}>}
   */
  async trimAndUpdateToFinalized(startBlockNumber) {
    if (SyncStatus.isLocked()) {
      this.app.log.error(`failed setup "trimAndUpdateToFinalized": sync in process`)
      return { result: false }
    }

    try {
      await this.trimBlocks(startBlockNumber)
      await this.processBlocks(startBlockNumber)
    } catch (err) {
      this.app.log.error(`failed to execute trimAndUpdateToFinalized: ${err}`)
    }
    return { result: true }
  }

  /**
   *
   * @param {number} blockNumber
   * @param {Vec<EventRecord>} events
   * @returns {Promise<Array<Object>>}
   */
  async processInherents(blockNumber, events) {
    const extrinsics = []

    return extrinsics
  }

  /**
   *
   * @param {number} blockNumber
   * @param {Vec<EventRecord>} events
   * @returns {Promise<Array<Object>>}
   */
  async processEvents(blockNumber, events) {
    const blockEvents = []
    events.forEach((record, eventIndex) => {
      const { event, phase } = record
      const types = event.typeDef

      const eventData = []

      /* if (event.section === 'session') {
                if (event.method === 'NewSession') {
                    console.log('new session')
                }
                //   console.log(event.data.toJSON())
                //    console.log(event.data.toString())
            } else if (event.section === 'staking') {

            } */

      if (event.data.length) {
        event.data.forEach((data, index) => {
          eventData.push({
            [types[index].type]: data
          })
        })

        blockEvents.push({
          id: `${blockNumber}-${eventIndex}`,
          section: event.section,
          method: event.method,
          phase: phase.toJSON(),
          meta: event.meta.toJSON(),
          data: eventData,
          event: event.toJSON()
        })
      }
    })
    return blockEvents
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
 * @type {{BlocksService: BlocksService}}
 */
module.exports = {
  BlocksService: BlocksService
}

const { hexToString } = require('@polkadot/util');

/**
 * Provides identity enrichment processing service
 * @class
 */
class IdentityProcessorService {
  /**
   * Creates an instance of ConsumerService.
   * @constructor
   * @param {object} app - The fastify instance object
   */
  constructor(app) {
    /** @private */
    this.app = app

    /** @private */
    const { polkadotConnector } = this.app

    if (!polkadotConnector) {
      throw new Error('cant get .polkadotConnector from fastify app.')
    }

    const { kafkaProducer } = this.app

    if (!kafkaProducer) {
      throw new Error('cant get .kafkaProducer from fastify app.')
    }

  }

  /**
   * Identity entry
   *
   * @typedef {Object} IdentityEntry
   * @property {string} event_id
   * @property {string} account_id
   * @property {string} event
   * @property {number} block_id
   */

  /**
   * Process identity entry
   *
   * @async
   * @param {IdentityEntry} entry
   * @returns {Promise<void>}
   */
  async process(entry) {

    this.app.log.debug(`Process enrichment for entry`)

    switch (entry.event) {
        case 'NewAccount':
            await this.onNewAccount(entry)
            break
        case 'KilledAccount' :
            await this.onKilledAccount(entry)
            break
        default:
            this.app.log.error(`failed to process undefined entry with event type "${entry.event}"`)
    }
  }

    /**
     * Process new account
     *
     * @private
     * @async
     * @param {IdentityEntry} entry
     * @returns {Promise<void>}
     */
  async onNewAccount(entry) {
        let identity = await this.getIdentity(entry.account_id)
        if (identity) {
            console.log(identity.toString())
            await this.pushEnrichment(entry.event_id, {
                account_id: entry.account_id,
                block_id: entry.block_id,
                display: hexToString(identity.value.info.display.asRaw.toHex()),
                legal: hexToString(identity.value.info.legal.asRaw.toHex()),
                web: hexToString(identity.value.info.web.asRaw.toHex()),
                riot: hexToString(identity.value.info.riot.asRaw.toHex()),
                email: hexToString(identity.value.info.email.asRaw.toHex()),
                twitter: hexToString(identity.value.info.twitter.asRaw.toHex())
            })
        }
  }

    /**
     * Process killed account
     *
     * @private
     * @async
     * @param {IdentityEntry} entry
     * @returns {Promise<void>}
     */
    async onKilledAccount(entry) {

    }

  /**
   * Get identity data
   *
   * @private
   * @async
   * @param {string} accountId - The block hash
   */
  async getIdentity(accountId) {
    const { polkadotConnector } = this.app

    let identity = await polkadotConnector.query.identity.identityOf(accountId)
    if (identity.isEmpty) {
      let superAccount = await polkadotConnector.query.identity.superOf(accountId)
      if (superAccount.isEmpty) {
        return null
      }
      return await this.getIdentity(superAccount.value[0].toString())
    }
    return identity;
  }

  /**
   *
   * @typedef {Object} IdentityEnrichment
   * @property {string} account_id
   * @property {number} block_id
   * @property {string} display
   * @property {string} legal
   * @property {string} web
   * @property {string} riot
   * @property {string} email
   * @property {string} twitter
   */

  /**
   * Push enrichment
   *
   * @private
   * @async
   * @param {string} key
   * @param {IdentityEnrichment} data
   * @returns {Promise<void>}
   */
  async pushEnrichment(key, data) {
    const { kafkaProducer } = this.app

    await kafkaProducer
        .send({
          topic: 'identity_enrichment_sink',
          messages: [
            {
              key: key,
              value: JSON.stringify(data)
            }
          ]
        })
        .catch((error) => {
          this.app.log.error(`failed to push identity enrichment: `, error)
        })
  }
}

module.exports = {
  IdentityProcessorService: IdentityProcessorService
}

const { hexToString } = require('@polkadot/util');
const { environment: { KAFKA_PREFIX } } = require('../environment')

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

    switch (entry.event) {
        case 'NewAccount':
            this.app.log.debug(`Process enrichment NewAccount`)
            await this.onNewAccount(entry)
            break
        case 'KilledAccount' :
            this.app.log.debug(`Process enrichment KilledAccount`)
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

        let superAccountIdRaw = await this.getSuperOf(entry.account_id)
        let superAccount = null
        if (!superAccountIdRaw.isEmpty) {
            superAccount = await this.getIdentity(superAccountIdRaw.value[0].toString())

            if (superAccount) {
                await this.pushEnrichment(entry.event_id, {
                    account_id: superAccountIdRaw.value[0].toString(),
                    display: superAccount.value.info ? hexToString(superAccount.value.info.display.asRaw.toHex()) : null,
                    legal: superAccount.value.info ? hexToString(superAccount.value.info.legal.asRaw.toHex()) : null,
                    web: superAccount.value.info ? hexToString(superAccount.value.info.web.asRaw.toHex()) : null,
                    riot: superAccount.value.info ? hexToString(superAccount.value.info.riot.asRaw.toHex()) : null,
                    email: superAccount.value.info ? hexToString(superAccount.value.info.email.asRaw.toHex()) : null,
                    twitter: superAccount.value.info ? hexToString(superAccount.value.info.twitter.asRaw.toHex()) : null
                })
            } else {
                await this.pushEnrichment(entry.event_id, {
                    account_id: superAccountIdRaw.value[0].toString()
                })
            }
        }

        if (identity) {
            await this.pushEnrichment(entry.event_id, {
                account_id: entry.account_id,
                root_account_id: !superAccountIdRaw.isEmpty ? superAccountIdRaw.value[0].toString() : null,
                created_at: entry.block_id,
                display: identity.value.info ? hexToString(identity.value.info.display.asRaw.toHex()) : null,
                legal: identity.value.info ? hexToString(identity.value.info.legal.asRaw.toHex()) : null,
                web:  identity.value.info ? hexToString(identity.value.info.web.asRaw.toHex()) : null,
                riot: identity.value.info ? hexToString(identity.value.info.riot.asRaw.toHex()) : null,
                email: identity.value.info ? hexToString(identity.value.info.email.asRaw.toHex()) : null,
                twitter: identity.value.info ? hexToString(identity.value.info.twitter.asRaw.toHex()) : null
            })
        } else {
            await this.pushEnrichment(entry.event_id, {
                account_id: entry.account_id,
                root_account_id: !superAccountIdRaw.isEmpty ? superAccountIdRaw.value[0].toString() : null,
                created_at: entry.block_id
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
        await this.pushEnrichment(entry.event_id, {
            account_id: entry.account_id,
            killed_at: entry.block_id
        })
    }

  /**
   * Get identity data
   *
   * @private
   * @async
   * @param {string} accountId - The account id
   */
  async getIdentity(accountId) {
    const { polkadotConnector } = this.app
    return await polkadotConnector.query.identity.identityOf(accountId);
  }

    async getSuperOf(accountId) {
        const { polkadotConnector } = this.app
        return await polkadotConnector.query.identity.superOf(accountId);
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
          topic: KAFKA_PREFIX + '_IDENTITY_ENRICHMENT_DATA',
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

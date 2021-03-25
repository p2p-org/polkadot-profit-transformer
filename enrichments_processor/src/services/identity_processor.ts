import {FastifyInstance} from 'fastify';
import {
    IApplication,
    IIdentityProcessorService,
    IEvent,
    IExtrinsicsEntry,
    IExtrinsic
} from './identity_processor.types';


const {hexToString} = require('@polkadot/util')
const {
    environment: {KAFKA_PREFIX}
} = require('../environment')

/**
 * Provides identity enrichment processing service
 * @class
 */
class IdentityProcessorService implements IIdentityProcessorService {
    /**
     * Creates an instance of ConsumerService.
     * @constructor
     * @param {object} app - The fastify instance object
     */
    constructor(app: FastifyInstance & IApplication) {
        /** @private */
        this.app = app

        /** @private */
        const {polkadotConnector} = this.app

        if (!polkadotConnector) {
            throw new Error('cant get .polkadotConnector from fastify app.')
        }

        const {kafkaProducer} = this.app

        if (!kafkaProducer) {
            throw new Error('cant get .kafkaProducer from fastify app.')
        }
    }

    /**
     * Identity entry from event
     *
     * @typedef {Object} EventIdentityEntry
     * @property {string} event_id
     * @property {string} account_id
     * @property {string} event
     * @property {number} block_id
     */

    /**
     * Process identity entry from event
     *
     * @async
     * @param {EventIdentityEntry} event
     * @returns {Promise<void>}
     */
    async processEvent(event: IEvent) {
        switch (event.event) {
            case 'NewAccount':
                this.app.log.debug(`Process enrichment NewAccount`)
                await this.onNewAccount(event)
                return
            case 'KilledAccount':
                this.app.log.debug(`Process enrichment KilledAccount`)
                await this.onKilledAccount(event)
                return
            default:
                this.app.log.error(`failed to process undefined entry with event type "${event.event}"`)
        }
    }

    /**
     * Process new account
     *
     * @private
     * @async
     * @param {EventIdentityEntry} event
     * @returns {Promise<void>}
     */
    async onNewAccount(event: IEvent) {
        return this.pushEnrichment(event.event_id, {
            account_id: event.account_id,
            created_at: event.block_id
        })
    }

    /**
     * Process killed account
     *
     * @private
     * @async
     * @param {EventIdentityEntry} event
     * @returns {Promise<void>}
     */
    async onKilledAccount(event: IEvent) {
        return this.pushEnrichment(event.event_id, {
            account_id: event.account_id,
            killed_at: event.block_id
        })
    }

    /**
     * Identity entry from extrinsic
     *
     * @typedef {Object} ExtrinsicIdentityEntry
     * @property {number} block_id
     * @property {string} method
     * @property {string} signer
     */

    /**
     * Process identity entry from extrinsic
     *
     * @async
     * @param {ExtrinsicIdentityEntry} entry
     * @returns {Promise<void>}
     */
    async processExtrinsics({extrinsics}: IExtrinsicsEntry) {

        const isValidIdentityExtrinsic = (extrinsic: IExtrinsic) => {
            const identityMethods = ['clearIdentity', 'killIdentity', 'setFields', 'setIdentity']
            return identityMethods.includes(extrinsic.method) && extrinsic.signer
        }

        const isValidSubsExtrinsic = (extrinsic: IExtrinsic) => {
            const subsMethods = ['addSub', 'quitSub', 'removeSub', 'renameSub', 'setSubs']
            return subsMethods.includes(extrinsic.method) && extrinsic.signer
        }

        for (const extrinsic of extrinsics) {
            if (isValidIdentityExtrinsic(extrinsic)) {
                await this.updateAccountIdentity(extrinsic)
                return
            }

            if (isValidSubsExtrinsic(extrinsic)) {
                await this.updateSubAccounts(extrinsic)
                return
            }
        }
    }

    /**
     *
     * @param {Object} entry
     * @returns {Promise<void>}
     */
    async updateAccountIdentity({id: key, signer: accountId}: IExtrinsic) {
        const identity = await this.getIdentity(accountId)

        if (identity) {
            const {
                value: {info: identityInfo}
            } = identity

            return this.pushEnrichment(key, {
                account_id: accountId,
                display: identityInfo ? hexToString(identityInfo.display.asRaw.toHex()) : null,
                legal: identityInfo ? hexToString(identityInfo.legal.asRaw.toHex()) : null,
                web: identityInfo ? hexToString(identityInfo.web.asRaw.toHex()) : null,
                riot: identityInfo ? hexToString(identityInfo.riot.asRaw.toHex()) : null,
                email: identityInfo ? hexToString(identityInfo.email.asRaw.toHex()) : null,
                twitter: identityInfo ? hexToString(identityInfo.twitter.asRaw.toHex()) : null
            })
        } else {
            this.app.log.error(`updateAccountIdentity: no identity found for ${accountId} from extrinsic ${key}`)
        }
    }

    /**
     *
     * @param {Object} extrinsic
     * @returns {Promise<void>}
     */
    async updateSubAccounts(extrinsic: IExtrinsic) {
        const {method, args} = extrinsic

        const sendToPushEnrichment = ({key, accountId, rootAccountId}) => {
            return this.pushEnrichment(key, {
                account_id: accountId,
                root_account_id: rootAccountId
            })
        }

        /**
         * Extrinsic entry type
         *
         * @typedef {Object} Extrinsic
         */

        /**
         * Adds the given account to the sender's subs.
         *
         * @param {Extrinsic} extrinsic
         * @returns {Promise<void>}
         */
        const addSub = async (extrinsic: IExtrinsic) => {
            const [rawArg] = args
            const accountId = typeof rawArg === 'string' ? rawArg : rawArg.id
            const rootAccountId = extrinsic.signer
            const key = extrinsic.id
            return sendToPushEnrichment({key, accountId, rootAccountId})
        }

        /**
         * Set the sub-accounts of the sender.
         *
         * @param {Extrinsic} extrinsic
         * @returns {[Promise<void>]}
         */
        const setSubs = async (extrinsic: IExtrinsic) => {
            const [rawSubs] = args
            const rootAccountId = extrinsic.signer
            const key = extrinsic.id
            return Promise.all(rawSubs.map(([accountId], index) => sendToPushEnrichment({
                key: `${key}_${index}`,
                accountId,
                rootAccountId
            })))
        }

        /**
         * Remove the given account from the sender's subs.
         *
         * extrinsic.args could be of two types:
         *
         * ["14TMfeiXiV7oG522eVuKBYi2VsgSMzjFiJYhiXPmbBNzFRQZ"]
         * or
         * [{ "id": "13SjEpJXxro4HKDLuxjfg3oYP8zpS8E78ZdoabUF4sN4B3hJ"}]
         *
         * @param {Extrinsic} extrinsic
         * @returns {Promise<void>}
         */
        const removeSub = async (extrinsic: IExtrinsic) => {
            const [rawArg] = extrinsic.args
            const key = extrinsic.id
            const accountId = typeof rawArg === 'string' ? rawArg : rawArg.id
            return sendToPushEnrichment({key, accountId, rootAccountId: null})
        }

        /**
         * Remove the sender as a sub-account.
         *
         * @param {Extrinsic} extrinsic
         * @returns {Promise<void>}
         */
        const quitSub = async (extrinsic: IExtrinsic) => {
            const key = extrinsic.id
            const accountId = extrinsic.signer
            return sendToPushEnrichment({key, accountId, rootAccountId: null})
        }

        switch (method) {
            case 'addSub':
                await addSub(extrinsic)
                break
            case 'setSubs':
                await setSubs(extrinsic)
                break
            case 'removeSub':
                await removeSub(extrinsic)
                break
            case 'quitSub':
                await quitSub(extrinsic)
                break
            case 'renameSubs':
                // 2do discover what is sub name
                break
            default:
                return
        }
    }

    /**
     * Get identity data
     *
     * @private
     * @async
     * @param {string} accountId - The account id
     */
    async getIdentity(accountId: string) {
        const {polkadotConnector} = this.app
        return await polkadotConnector.query.identity.identityOf(accountId)
    }

    /**
     *
     * @typedef {Object} IdentityEnrichment
     * @property {string} account_id
     * @property {string} root_account_id
     * @property {number} block_id
     * @property {string} display
     * @property {string} legal
     * @property {string} web
     * @property {string} riot
     * @property {string} email
     * @property {string} twitter
     * @property {number} created_at
     * @property {number} killed_at
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
        const {kafkaProducer} = this.app

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

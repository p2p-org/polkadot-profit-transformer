const { KAFKA_PREFIX, DB_SCHEMA } = require('../environment')


/**
 * Provides extrinsics extraction methods
 * @class
 */

class ExtrinsicsService {
    /**
     * Creates an instance of ExtrinsicsService.
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

    /**
     *
     * @param eraId numeric
     * @param sessionId numeric
     * @param blockNumber numeric
     * @param events Array
     * @param extrinsics Vec<GenericExtrinsic>
     * @returns {Promise<void>}
     */
    async extractExtrinsics(eraId, sessionId, blockNumber, events, extrinsicsVec) {
        const { kafkaProducer } = this.app

        let extrinsics = []

        extrinsicsVec.forEach((extrinsic, exIndex) => {
            const referencedEventsIds = events
                .filter(({phase}) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(exIndex))
                .map(({event}, evIndex) => `${blockNumber}-${evIndex}`)

            if (extrinsic.method.method === 'batch') {
                extrinsic.method.args[0].forEach((batchExtrinsicEntry, batchExIndex) => {
                    extrinsics.push({
                        id: `${blockNumber}-${exIndex}-${batchExIndex}`,
                        block_id: blockNumber,
                        parent_id: `${blockNumber}-${exIndex}`,
                        session_id: sessionId,
                        era: eraId,
                        section: batchExtrinsicEntry.section,
                        method: batchExtrinsicEntry.method,
                        mortal_period: extrinsic.era.isMortalEra ? extrinsic.era.asMortalEra.period.toNumber() : null,
                        mortal_phase: extrinsic.era.isMortalEra ? extrinsic.era.asMortalEra.phase.toNumber() : null,
                        is_signed: extrinsic.isSigned,
                        signer: extrinsic.isSigned ? extrinsic.signer.toString() : null,
                        tip: extrinsic.tip.toNumber(),
                        nonce: extrinsic.nonce.toNumber(),
                        ref_event_ids: referencedEventsIds.length > 0 ? `{${referencedEventsIds.map((value) => `"${value}"`).join(',')}}` : null,
                        version: extrinsic.tip.toNumber(),
                        extrinsic: batchExtrinsicEntry.toHuman(),
                        args: batchExtrinsicEntry.args
                    })
                })
            }

            extrinsics.push({
                id: `${blockNumber}-${exIndex}`,
                block_id: blockNumber,
                session_id: sessionId,
                era: eraId,
                section: extrinsic.method.section,
                method: extrinsic.method.method,
                mortal_period: extrinsic.era.isMortalEra ? extrinsic.era.asMortalEra.period.toNumber() : null,
                mortal_phase: extrinsic.era.isMortalEra ? extrinsic.era.asMortalEra.phase.toNumber() : null,
                is_signed: extrinsic.isSigned,
                signer: extrinsic.isSigned ? extrinsic.signer.toString() : null,
                tip: extrinsic.tip.toNumber(),
                nonce: extrinsic.nonce.toNumber(),
                ref_event_ids: referencedEventsIds.length > 0 ? `{${referencedEventsIds.map((value) => `"${value}"`).join(',')}}` : null,
                version: extrinsic.tip.toNumber(),
                extrinsic: extrinsic.toHuman(),
                args: extrinsic.args
            })

        })

        await kafkaProducer
            .send({
                topic: KAFKA_PREFIX + '_EXTRINSICS_DATA',
                messages: [
                    {
                        key: blockNumber.toString(),
                        value: JSON.stringify({
                            extrinsics: extrinsics
                        })
                    }
                ]
            })
            .catch((error) => {
                this.app.log.error(`failed to push block: `, error)
                throw new Error('cannot push block to Kafka')
            })

    }
}

/**
 *
 * @type {{ExtrinsicsService: ExtrinsicsService}}
 */
module.exports = {
    ExtrinsicsService: ExtrinsicsService
}

import { environment } from '../../environment';
import { FastifyInstance } from 'fastify';
import { IExtrinsic, IExtrinsicsService } from './extrinsics.types';

const {KAFKA_PREFIX} = environment;

/**
 * Provides extrinsics extraction methods
 * @class
 */

class ExtrinsicsService implements IExtrinsicsService {
  private readonly app: FastifyInstance;

  /**
   * Creates an instance of ExtrinsicsService.
   * @param {object} app fastify app
   */
  constructor(app: FastifyInstance) {
    if (!app.ready) throw new Error(`can't get .ready from fastify app.`);

    /** @private */
    this.app = app;

    const {polkadotConnector} = this.app;

    if (!polkadotConnector) {
      throw new Error('cant get .polkadotConnector from fastify app.');
    }

    const {kafkaProducer} = this.app;

    if (!kafkaProducer) {
      throw new Error('cant get .kafkaProducer from fastify app.');
    }

    const {postgresConnector} = this.app;

    if (!postgresConnector) {
      throw new Error('cant get .postgresConnector from fastify app.');
    }

    postgresConnector.connect((err, client, release) => {
      if (err) {
        this.app.log.error(`Error acquiring client: ${err.toString()}`);
        throw new Error(`Error acquiring client`);
      }
      client.query('SELECT NOW()', (err) => {
        release();
        if (err) {
          this.app.log.error(`Error executing query: ${err.toString()}`);
          throw new Error(`Error executing query`);
        }
      });
    });
  }

  async extractExtrinsics(...args: Parameters<IExtrinsicsService['extractExtrinsics']>): Promise<void> {
    const [
      eraId,
      sessionId,
      blockNumber,
      events,
      extrinsicsVec
    ] = args;

    const {kafkaProducer} = this.app;

    const extrinsics: IExtrinsic[] = []

    extrinsicsVec.forEach((extrinsic, exIndex) => {
      const referencedEventsIds = events
        .filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(exIndex))
        .map((_, evIndex) => `${blockNumber}-${evIndex}`)

      if (extrinsic.method.method === 'batch') {
        //fix it later, most probably something bad is going on here
        //@ts-ignore
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
export {
  ExtrinsicsService
}

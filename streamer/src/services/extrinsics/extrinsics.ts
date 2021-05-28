import { IExtrinsic, IExtrinsicsService } from './extrinsics.types'
import { IKafkaModule, KafkaModule } from '../../modules/kafka.module'


/**
 * Provides extrinsics extraction methods
 * @class
 */

class ExtrinsicsService implements IExtrinsicsService {
  private readonly kafka: IKafkaModule = KafkaModule.inject()

  async extractExtrinsics(...args: Parameters<IExtrinsicsService['extractExtrinsics']>): Promise<void> {
    const [
      eraId,
      sessionId,
      blockNumber,
      events,
      extrinsicsVec
    ] = args

    const extrinsics: IExtrinsic[] = []

    extrinsicsVec.forEach((extrinsic, exIndex) => {
      const referencedEventsIds = events
        .filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(exIndex))
        .map((_, evIndex) => `${blockNumber}-${evIndex}`)

      if (extrinsic.method.method === 'batch') {
        //fix it later, most probably something bad is going on here
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
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

    await this.kafka.sendExtrinsicsData(blockNumber.toString(), extrinsics)
  }
}

/**
 *
 * @type {{ExtrinsicsService: ExtrinsicsService}}
 */
export {
  ExtrinsicsService
}

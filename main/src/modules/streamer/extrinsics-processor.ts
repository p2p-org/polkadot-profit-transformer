/* eslint-disable @typescript-eslint/ban-ts-comment */
import { isExtrinsicSuccess } from './../governance-processor/processors/utils/isExtrinsicSuccess'
import { PolkadotRepository } from '../../apps/common/infra/polkadotapi/polkadot.repository'
import { Compact, GenericExtrinsic, Vec } from '@polkadot/types'
import { BlockNumber, EventRecord, OpaqueCall } from '@polkadot/types/interfaces'
import { ExtrinsicModel } from 'apps/common/infra/postgresql/models/extrinsic.model'

export type ExtrinsicsProcessorInput = {
  eraId: number
  sessionId: number
  blockNumber: Compact<BlockNumber>
  events: Vec<EventRecord>
  extrinsics: Vec<GenericExtrinsic>
}

export type ExtrinsicsProcessor = ReturnType<typeof ExtrinsicsProcessor>

export const ExtrinsicsProcessor = (args: { polkadotRepository: PolkadotRepository }) => {
  const { polkadotRepository } = args
  return async (input: ExtrinsicsProcessorInput): Promise<ExtrinsicModel[]> => {
    const { eraId, sessionId, blockNumber, events, extrinsics } = input

    const extractedExtrinsics: ExtrinsicModel[] = []

    for (let index = 0; index < extrinsics.length; index++) {
      const extrinsic = extrinsics[index]

      const isSuccess = await isExtrinsicSuccess(index, events, polkadotRepository)

      const referencedEventsIds = events
        .filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index))
        .map((_, evIndex) => `${blockNumber}-${evIndex}`)

      const mainExtrinsic: ExtrinsicModel = {
        id: `${blockNumber}-${index}`,
        success: isSuccess,
        block_id: blockNumber.toNumber(),
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
        args: extrinsic.args,
      }

      extractedExtrinsics.push(mainExtrinsic)

      if (extrinsic.method.method === 'batch') {
        //fix it later, most probably something bad is going on here
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        const batchExtrinsics = extrinsic.method.args[0].map((batchExtrinsicEntry, batchExIndex) => {
          const batchPartExtrinsic: ExtrinsicModel = {
            id: `${blockNumber}-${index}-${batchExIndex}`,
            block_id: blockNumber.toNumber(),
            success: isSuccess,
            parent_id: `${blockNumber}-${index}`,
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
            ref_event_ids:
              referencedEventsIds.length > 0 ? `{${referencedEventsIds.map((value) => `"${value}"`).join(',')}}` : null,
            version: extrinsic.tip.toNumber(),
            extrinsic: batchExtrinsicEntry.toHuman(),
            args: batchExtrinsicEntry.args,
          }
          return batchPartExtrinsic
        })

        extractedExtrinsics.push(batchExtrinsics)
      }

      if (extrinsic.method.method === 'asMulti' && extrinsic.method.section == 'multisig') {
        const opaqueCall = <OpaqueCall>extrinsic.args[3]
        const call = opaqueCall.registry.createType('Call', opaqueCall.toU8a(true))
        // const call = <Call>polkadotRepository.createType('Call', opaqueCall.toU8a(true))
        console.log(call.method, call.section)

        const multisigExtrinsicCall: ExtrinsicModel = {
          id: `${blockNumber}-${index}-0`,
          block_id: blockNumber.toNumber(),
          success: isSuccess,
          parent_id: `${blockNumber}-${index}`,
          session_id: sessionId,
          era: eraId,
          section: call.section,
          method: call.method,
          mortal_period: extrinsic.era.isMortalEra ? extrinsic.era.asMortalEra.period.toNumber() : null,
          mortal_phase: extrinsic.era.isMortalEra ? extrinsic.era.asMortalEra.phase.toNumber() : null,
          is_signed: extrinsic.isSigned,
          signer: extrinsic.isSigned ? extrinsic.signer.toString() : null,
          tip: extrinsic.tip.toNumber(),
          nonce: extrinsic.nonce.toNumber(),
          ref_event_ids:
            referencedEventsIds.length > 0 ? `{${referencedEventsIds.map((value) => `"${value}"`).join(',')}}` : null,
          version: extrinsic.tip.toNumber(),
          extrinsic: call.toHuman(),
          args: call.args,
        }

        extractedExtrinsics.push(multisigExtrinsicCall)

        if (call.section === 'utility' && call.method === 'batch') {
          // @ts-ignore
          const multisigBatchExtrinsics = call.args[0].map((batchExtrinsicEntry, batchExIndex) => {
            const batchPartExtrinsic: ExtrinsicModel = {
              id: `${blockNumber}-${index}-0-${batchExIndex}`,
              block_id: blockNumber.toNumber(),
              success: isSuccess,
              parent_id: `${blockNumber}-${index}`,
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
              ref_event_ids:
                referencedEventsIds.length > 0 ? `{${referencedEventsIds.map((value) => `"${value}"`).join(',')}}` : null,
              version: extrinsic.tip.toNumber(),
              extrinsic: batchExtrinsicEntry.toHuman(),
              args: batchExtrinsicEntry.args,
            }
            return batchPartExtrinsic
          })
          extractedExtrinsics.push(multisigBatchExtrinsics)
        }
      }

      if (extrinsic.method.method === 'proxy' && extrinsic.method.section == 'proxy') {
        const opaqueCall = <OpaqueCall>extrinsic.args[2]
        const call = opaqueCall.registry.createType('Call', opaqueCall.toU8a(true))

        const proxyExtrinsicCall: ExtrinsicModel = {
          id: `${blockNumber}-${index}-0`,
          block_id: blockNumber.toNumber(),
          parent_id: `${blockNumber}-${index}`,
          success: isSuccess,
          session_id: sessionId,
          era: eraId,
          section: call.section,
          method: call.method,
          mortal_period: extrinsic.era.isMortalEra ? extrinsic.era.asMortalEra.period.toNumber() : null,
          mortal_phase: extrinsic.era.isMortalEra ? extrinsic.era.asMortalEra.phase.toNumber() : null,
          is_signed: extrinsic.isSigned,
          signer: extrinsic.isSigned ? extrinsic.signer.toString() : null,
          tip: extrinsic.tip.toNumber(),
          nonce: extrinsic.nonce.toNumber(),
          ref_event_ids:
            referencedEventsIds.length > 0 ? `{${referencedEventsIds.map((value) => `"${value}"`).join(',')}}` : null,
          version: extrinsic.tip.toNumber(),
          extrinsic: call.toHuman(),
          args: call.args,
        }

        extractedExtrinsics.push(proxyExtrinsicCall)

        if (call.section === 'utility' && call.method === 'batch') {
          // @ts-ignore
          const proxyBatchExtrinsics = call.args[0].map((batchExtrinsicEntry, batchExIndex) => {
            const batchPartExtrinsic: ExtrinsicModel = {
              id: `${blockNumber}-${index}-0-${batchExIndex}`,
              block_id: blockNumber.toNumber(),
              success: isSuccess,
              parent_id: `${blockNumber}-${index}`,
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
              ref_event_ids:
                referencedEventsIds.length > 0 ? `{${referencedEventsIds.map((value) => `"${value}"`).join(',')}}` : null,
              version: extrinsic.tip.toNumber(),
              extrinsic: batchExtrinsicEntry.toHuman(),
              args: batchExtrinsicEntry.args,
            }
            return batchPartExtrinsic
          })
          extractedExtrinsics.push(proxyBatchExtrinsics)
        }
      }
    }

    return extractedExtrinsics.flat(Infinity)
  }
}

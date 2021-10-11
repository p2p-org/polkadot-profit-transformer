import { isExtrinsicSuccess } from './utils/is-extrinsic-success'
import { PolkadotRepository } from '../../apps/common/infra/polkadotapi/polkadot.repository'
import { Compact, GenericExtrinsic, Vec } from '@polkadot/types'
import { BlockNumber, EventRecord, OpaqueCall, Call } from '@polkadot/types/interfaces'
import { ExtrinsicModel } from 'apps/common/infra/postgresql/models/extrinsic.model'
import { AnyTuple } from '@polkadot/types/types'

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

    const createExtrinsicModelFromCall = (
      call: Call,
      isSuccess: boolean,
      extrinsic: GenericExtrinsic<AnyTuple>,
      index: string,
      referencedEventsIds: string[],
    ): ExtrinsicModel => {
      const extrinsicModel: ExtrinsicModel = {
        id: `${blockNumber}-${index}`,
        success: isSuccess,
        block_id: blockNumber.toNumber(),
        session_id: sessionId,
        era: eraId,
        section: call.section,
        method: call.method,
        mortal_period: extrinsic.era.isMortalEra ? extrinsic.era.asMortalEra.period.toNumber() : null,
        mortal_phase: extrinsic.era.isMortalEra ? extrinsic.era.asMortalEra.phase.toNumber() : null,
        is_signed: extrinsic.isSigned,
        signer: extrinsic.isSigned ? extrinsic.signer.toString() : null,
        tip: extrinsic.tip.toString(),
        nonce: extrinsic.nonce.toNumber(),
        ref_event_ids: referencedEventsIds.length > 0 ? `{${referencedEventsIds.map((value) => `"${value}"`).join(',')}}` : null,
        version: extrinsic.version,
        extrinsic: call.toHuman(),
        args: call.args,
      }

      return extrinsicModel
    }

    type callEntry = {
      call: Call
      indexes: number[]
      index: number
    }
    const recursiveExtrinsicDecoder = (entry: callEntry): callEntry[] => {
      const currentIndexes = [...entry.indexes, entry.index]

      if (entry.call.section === 'utility' && entry.call.method === 'batch') {
        console.log('batch')
        const processedBatchCalls = (<Vec<Call>>entry.call.args[0])
          .map((call, index) => recursiveExtrinsicDecoder({ call, indexes: currentIndexes, index }))
          .flat()
        return [entry, ...processedBatchCalls]
      }

      if (entry.call.section === 'multisig' && entry.call.method === 'asMulti') {
        console.log('multisig')
        const innerCall = entry.call.registry.createType('Call', entry.call.args[3])
        return [entry, ...recursiveExtrinsicDecoder({ call: innerCall, indexes: currentIndexes, index: 0 })]
      }

      if (entry.call.section === 'proxy' && entry.call.method === 'proxy') {
        // console.log('proxy', call.args[2].toHuman())
        const innerCall = entry.call.registry.createType('Call', entry.call.args[2])
        return [entry, ...recursiveExtrinsicDecoder({ call: innerCall, indexes: currentIndexes, index: 0 })]
      }

      return [entry]
    }

    const result = await Promise.all(
      extrinsics.map(async (extrinsic, index) => {
        const isSuccess = await isExtrinsicSuccess(index, events, polkadotRepository)
        const initialCall = extrinsic.registry.createType('Call', extrinsic.method)
        const extractedExtrinsics = recursiveExtrinsicDecoder({ call: initialCall, indexes: [], index })
        const referencedEventsIds = events
          .filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(index))
          .map((_, evIndex) => `${blockNumber}-${evIndex}`)
        const extrinsicModels = extractedExtrinsics.map(({ call, indexes, index }) =>
          createExtrinsicModelFromCall(call, isSuccess, extrinsic, [...indexes, index].join('-'), referencedEventsIds),
        )
        return extrinsicModels
      }),
    )

    const r = result.flat()
    // console.log(JSON.stringify(r, null, 2))
    return r
  }
}

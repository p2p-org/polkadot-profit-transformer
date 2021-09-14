import { Extrinsic } from '@modules/governance/types'
import { ApiPromise } from '@polkadot/api'
import { Logger } from 'apps/common/infra/logger/logger'
import { ExtrinsicProcessor } from './../extrinsics/index'
import { processAsMultiExtrinsic } from './asMulti'

export type MultisigExtrinsicProcessor = ReturnType<typeof MultisigExtrinsicProcessor>

export const MultisigExtrinsicProcessor = (deps: { extrinsicProcessor: ExtrinsicProcessor; polkadotApi: ApiPromise; logger: Logger }) => {
  const { extrinsicProcessor, logger, polkadotApi } = deps

  return {
    asMulti: (extrinsic: Extrinsic) => processAsMultiExtrinsic(extrinsic, logger, polkadotApi, extrinsicProcessor),
  }
}

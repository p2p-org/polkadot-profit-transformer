import { Extrinsic } from '@modules/governance/types'
import { ApiPromise } from '@polkadot/api'
import { Logger } from 'apps/common/infra/logger/logger'
import { processAsMultiExtrinsic } from './asMulti'

export type MultisigExtrinsicProcessor = ReturnType<typeof MultisigExtrinsicProcessor>

export const MultisigExtrinsicProcessor = (deps: { polkadotApi: ApiPromise; logger: Logger }) => {
  const { logger, polkadotApi } = deps

  return {
    asMulti: (extrinsic: Extrinsic) => processAsMultiExtrinsic(extrinsic, logger, polkadotApi),
  }
}

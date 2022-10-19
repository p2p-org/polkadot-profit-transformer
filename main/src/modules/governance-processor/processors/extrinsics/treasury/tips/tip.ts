import { Logger } from 'loaders/logger'
import { AccountId } from '@polkadot/types/interfaces'
import { Bytes } from '@polkadot/types'
import { ExtrincicProcessorInput } from '../..'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { TipsModel } from '@/models/tips.model'

export const processTreasuryTipExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { extrinsic } = args
  logger.info({ extrinsic }, 'processTreasuryTipExtrinsic')

  const hash = <Bytes>extrinsic.args[0]
  console.log(hash.toString())

  const tip_value = (<AccountId>extrinsic.args[1]).toString()
  console.log(tip_value.toString())

  const tipModel: TipsModel = {
    hash: hash.toString(),
    block_id: extrinsic.block_id,
    event: 'Tip',
    data: {
      sender: extrinsic.signer,
      tip_value,
    },
    extrinsic_id: extrinsic.id,
    event_id: 'Tip',
  }

  console.log({ tipModel })

  await governanceRepository.tips.save(tipModel)
}

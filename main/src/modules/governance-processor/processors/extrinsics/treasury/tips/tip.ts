import { TipsModel } from '../../../../../../apps/common/infra/postgresql/governance/models/tips.model'
// import { TechnicalCommiteeProposalModel } from '../../../../../apps/common/infra/postgresql/governance/models/technicalCommiteeModels'
import { Logger } from 'apps/common/infra/logger/logger'
import { AccountId } from '@polkadot/types/interfaces'
import { Bytes } from '@polkadot/types'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance/governance.repository'
import { ExtrincicProcessorInput } from '../..'

export const processTreasuryTipExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { fullExtrinsic, extrinsic } = args
  logger.info({ extrinsic }, 'processTreasuryTipExtrinsic')

  const hash = <Bytes>fullExtrinsic.args[0]
  console.log(hash.toString())

  const tip_value = (<AccountId>fullExtrinsic.args[1]).toString()
  console.log(tip_value.toString())

  const tipModel: TipsModel = {
    hash: hash.toString(),
    block_id: extrinsic.block_id,
    event: 'Tip',
    data: {
      sender: fullExtrinsic.signer.toString(),
      tip_value,
    },
    extrinsic_id: extrinsic.id,
    event_id: 'Tip',
  }

  console.log({ tipModel })

  await governanceRepository.tips.save(tipModel)
}

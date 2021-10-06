import { TipsModel } from '../../../../../../apps/common/infra/postgresql/governance/models/tips.model'
// import { TechnicalCommiteeProposalModel } from '../../../../../apps/common/infra/postgresql/governance/models/technicalCommiteeModels'
import { Logger } from 'apps/common/infra/logger/logger'
import { AccountId, H256 } from '@polkadot/types/interfaces'
import { Bytes, Compact, u128 } from '@polkadot/types'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance/governance.repository'
import { findEvent } from '@modules/governance-processor/processors/utils/findEvent'
import { ExtrincicProcessorInput } from '../..'

export const processTreasuryTipsNewExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { extrinsicEvents, fullExtrinsic, extrinsic } = args
  logger.info({ extrinsic }, 'processTreasuryTipsNewExtrinsic')

  const treasuryTipsNewEvent = findEvent(extrinsicEvents, 'tips', 'NewTip')
  if (!treasuryTipsNewEvent) throw Error('no tips newtip for enrty ' + extrinsic.id)

  const reason = <Bytes>fullExtrinsic.args[0]
  console.log(reason.toString())

  const who = <AccountId>fullExtrinsic.args[1]
  console.log(who.toString())

  const tip_value = <Compact<u128>>fullExtrinsic.args[2]
  console.log(tip_value.toString())

  const hash = <H256>treasuryTipsNewEvent.event.data[0]
  console.log(hash.toString())

  const tipModel: TipsModel = {
    hash: hash.toString(),
    block_id: extrinsic.block_id,
    event: 'TipNew',
    data: {
      sender: fullExtrinsic.signer.toString(),
      beneficiary: who,
      value: tip_value,
    },
    extrinsic_id: extrinsic.id,
    event_id: 'tip_new',
  }

  console.log({ tipModel })

  await governanceRepository.tips.save(tipModel)
}

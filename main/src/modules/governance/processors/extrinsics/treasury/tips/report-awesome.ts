import { TipsModel } from '../../../../../../apps/common/infra/postgresql/governance/models/TipsModel'
// import { TechnicalCommiteeProposalModel } from '../../../../../apps/common/infra/postgresql/governance/models/technicalCommiteeModels'
import { Logger } from 'apps/common/infra/logger/logger'
import { AccountId, H256 } from '@polkadot/types/interfaces'
import { Bytes } from '@polkadot/types'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance/governance.repository'
import { findEvent } from '@modules/governance/processors/utils/findEvent'
import { ExtrincicProcessorInput } from '../..'

export const processTreasuryReportAwesomeExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { extrinsicEvents, fullExtrinsic, extrinsic } = args
  logger.info({ extrinsic }, 'processTreasuryReportAwesomeExtrinsic')

  const treasuryTipsNewEvent = findEvent(extrinsicEvents, 'treasury', 'NewTip')
  if (!treasuryTipsNewEvent) throw Error('no tips newtip for enrty ' + extrinsic.id)

  const reason = <Bytes>fullExtrinsic.args[0]
  console.log(reason.toString())

  const who = <AccountId>fullExtrinsic.args[1]
  console.log(who.toString())

  const hash = <H256>treasuryTipsNewEvent.event.data[0]
  console.log(hash.toString())

  const tipModel: TipsModel = {
    hash: hash.toString(),
    block_id: extrinsic.block_id,
    event: 'reportAwesome',
    data: {
      sender: fullExtrinsic.signer.toString(),
      beneficiary: who,
    },
    extrinsic_id: extrinsic.id,
    event_id: 'reportAwesome',
  }

  console.log({ tipModel })

  await governanceRepository.tips.save(tipModel)
}

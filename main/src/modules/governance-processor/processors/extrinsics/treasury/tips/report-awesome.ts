import { Logger } from 'apps/common/infra/logger/logger'
import { AccountId, H256 } from '@polkadot/types/interfaces'
import { Bytes } from '@polkadot/types'
import { findEvent } from '@modules/governance-processor/processors/utils/findEvent'
import { ExtrincicProcessorInput } from '../..'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { TipsModel } from 'apps/common/infra/postgresql/models/tips.model'

export const processTreasuryReportAwesomeExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { events, extrinsic } = args
  logger.info({ extrinsic }, 'processTreasuryReportAwesomeExtrinsic')

  const treasuryTipsNewEvent = findEvent(events, 'treasury', 'NewTip')
  if (!treasuryTipsNewEvent) throw Error('no tips newtip for enrty ' + extrinsic.id)

  const reason = <Bytes>extrinsic.args[0]
  console.log(reason.toString())

  const who = <AccountId>extrinsic.args[1]
  console.log(who.toString())

  const hash = <H256>treasuryTipsNewEvent.event.data[0]
  console.log(hash.toString())

  const tipModel: TipsModel = {
    hash: hash.toString(),
    block_id: extrinsic.block_id,
    event: 'reportAwesome',
    data: {
      sender: extrinsic.signer,
      beneficiary: who,
    },
    extrinsic_id: extrinsic.id,
    event_id: 'reportAwesome',
  }

  console.log({ tipModel })

  await governanceRepository.tips.save(tipModel)
}

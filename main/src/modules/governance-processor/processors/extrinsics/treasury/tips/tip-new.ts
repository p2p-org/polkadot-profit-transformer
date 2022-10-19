// import { TechnicalCommiteeProposalModel } from '@/models/technicalCommiteeModels'
import { Logger } from 'loaders/logger'
import { AccountId, H256 } from '@polkadot/types/interfaces'
import { Bytes, Compact, u128 } from '@polkadot/types'
import { findEvent } from '@modules/governance-processor/processors/utils/findEvent'
import { ExtrincicProcessorInput } from '../..'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { TipsModel } from '@/models/tips.model'

export const processTreasuryTipsNewExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { events, extrinsic } = args
  logger.info({ extrinsic }, 'processTreasuryTipsNewExtrinsic')

  const treasuryTipsNewEvent = findEvent(events, 'tips', 'NewTip')
  if (!treasuryTipsNewEvent) throw Error('no tips newtip for enrty ' + extrinsic.id)

  const reason = <Bytes>extrinsic.args[0]
  console.log(reason.toString())

  const who = <AccountId>extrinsic.args[1]
  console.log(who.toString())

  const tip_value = <Compact<u128>>extrinsic.args[2]
  console.log(tip_value.toString())

  const hash = <H256>treasuryTipsNewEvent.event.data[0]
  console.log(hash.toString())

  const tipModel: TipsModel = {
    hash: hash.toString(),
    block_id: extrinsic.block_id,
    event: 'TipNew',
    data: {
      sender: extrinsic.signer,
      beneficiary: who,
      value: tip_value,
    },
    extrinsic_id: extrinsic.id,
    event_id: 'tip_new',
  }

  console.log({ tipModel })

  await governanceRepository.tips.save(tipModel)
}

import { DemocracyProposalModel } from './../../../../../../apps/common/infra/postgresql/governance/models/democracyModels'
import { GovernanceRepository } from '../../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { ExtrincicProcessorInput } from '../..'
import { u128, u32 } from '@polkadot/types'

export const processDemocracyProposalProposeExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { extrinsicEvents, fullExtrinsic, extrinsic } = args

  const democracyProposedEvent = extrinsicEvents.find((event) => {
    return event.event.section === 'democracy' && event.event.method === 'Proposed'
  })

  if (!democracyProposedEvent) {
    logger.warn('no democracy proposed event for extrinsic ' + extrinsic.id)
    return
  }

  const eventData = democracyProposedEvent.event.data
  const proposalId = (<u32>eventData[0]).toNumber()
  const balance = (<u128>eventData[1]).toNumber()

  const argsdef = fullExtrinsic.argsDef

  // fix for a few very early extrinsics in kusama, with the different schema
  if (argsdef['proposal']) {
    const proposal: DemocracyProposalModel = {
      id: proposalId,
      hash: proposalId.toString(),
      block_id: extrinsic.block_id,
      event_id: '',
      extrinsic_id: extrinsic.id,
      event: 'Proposed',
      data: { balance: balance, signer: extrinsic.signer, proposal: fullExtrinsic.args[0].toHuman() },
    }

    await governanceRepository.democracy.proposal.save(proposal)
    return
  }

  const proposal: DemocracyProposalModel = {
    id: proposalId,
    hash: extrinsic.args[0],
    block_id: extrinsic.block_id,
    event_id: '',
    extrinsic_id: extrinsic.id,
    event: 'Proposed',
    data: { balance: balance, signer: extrinsic.signer },
  }

  await governanceRepository.democracy.proposal.save(proposal)
}

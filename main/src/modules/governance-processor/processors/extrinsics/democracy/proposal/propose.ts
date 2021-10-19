import { Logger } from 'apps/common/infra/logger/logger'
import { ExtrincicProcessorInput } from '../..'
import { u128, u32 } from '@polkadot/types'
import { findEvent } from '@modules/governance-processor/processors/utils/findEvent'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { DemocracyProposalModel } from 'apps/common/infra/postgresql/models/democracy.model'
import { H256 } from '@polkadot/types/interfaces'

export const processDemocracyProposalProposeExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { events, extrinsic } = args

  const democracyProposedEvent = findEvent(events, 'democracy', 'Proposed')

  if (!democracyProposedEvent) {
    logger.warn('no democracy proposed event for extrinsic ' + extrinsic.id)
    return
  }

  const eventData = democracyProposedEvent.event.data
  const proposalId = (<u32>eventData[0]).toNumber()
  const balance = (<u128>eventData[1]).toString()

  console.log('extrinsic', extrinsic)

  // fix for a few very early extrinsics in kusama, with the different schema
  if (extrinsic.extrinsic.args[0]['method']) {
    const proposal: DemocracyProposalModel = {
      id: proposalId,
      hash: proposalId.toString(),
      block_id: extrinsic.block_id,
      event_id: '',
      extrinsic_id: extrinsic.id,
      event: 'Proposed',
      data: { balance: balance, signer: extrinsic.signer, proposal: extrinsic.args[0] },
    }

    await governanceRepository.democracy.proposal.save(proposal)
    return
  }

  const proposal: DemocracyProposalModel = {
    id: proposalId,
    hash: (<H256>extrinsic.args[0]).toString(),
    block_id: extrinsic.block_id,
    event_id: '',
    extrinsic_id: extrinsic.id,
    event: 'Proposed',
    data: { balance: balance, signer: extrinsic.signer },
  }

  await governanceRepository.democracy.proposal.save(proposal)
}

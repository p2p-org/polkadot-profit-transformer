import { DemocracyProposalModel } from './../../../../../../apps/common/infra/postgresql/governance/models/democracyModels'
import { GovernanceRepository } from '../../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { ExtrincicProcessorInput } from '../..'

export const processDemocracyProposalProposeExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { blockEvents, extrinsicFull, extrinsic } = args

  console.log('DEMOCRACY PROPOSE')
  console.log('EXTRINSIC', JSON.stringify(extrinsic, null, 2))

  const democracyProposedEvent = blockEvents.find((event) => {
    return event.event.section === 'democracy' && event.event.method === 'Proposed'
  })

  if (!democracyProposedEvent) {
    logger.warn('no democracy proposed event for extrinsic ' + extrinsic.id)
    return
  }

  const proposalId = parseInt(democracyProposedEvent?.event.data[0].toHex(), 16)

  const balance = democracyProposedEvent?.event.data[1].toJSON()

  console.log({ balance })

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

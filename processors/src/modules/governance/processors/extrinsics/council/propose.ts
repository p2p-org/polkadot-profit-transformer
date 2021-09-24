import { ApiPromise } from '@polkadot/api'
import { GovernanceRepository } from '../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { ExtrincicProcessorInput } from '..'
import { CouncilProposalModel } from 'apps/common/infra/postgresql/governance/models/councilMotionsModel'
import { AccountId, Call, Hash, MemberCount } from '@polkadot/types/interfaces'
import { GenericExtrinsic, u32 } from '@polkadot/types'
import { AnyTuple } from '@polkadot/types/types'

export const processCouncilProposeExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
  polkadotApi: ApiPromise,
): Promise<void> => {
  const { extrinsicEvents, fullExtrinsic, extrinsic } = args

  const councilProposedEvent = extrinsicEvents.find((event) => {
    return event.event.section === 'council' && event.event.method === 'Proposed'
  })

  if (!councilProposedEvent) {
    logger.warn('no council proposed event for extrinsic ' + extrinsic.id)
    return
  }

  const eventData = councilProposedEvent.event.data
  const ProposalIndex = (<u32>eventData[1]).toNumber()
  const motionHash = (<Hash>eventData[2]).toString()
  const memberCount = (<u32>eventData[3]).toNumber()

  const proposal = <Call>fullExtrinsic.args[1]
  const module = proposal.method
  const call = proposal.section
  const proposalId = proposal.args[0]

  const proposalModel: CouncilProposalModel = {
    id: ProposalIndex,
    hash: motionHash,
    block_id: extrinsic.block_id,
    event_id: extrinsic.block_id + '-' + councilProposedEvent.event.index,
    extrinsic_id: extrinsic.id,
    event: 'Proposed',
    data: {
      signer: fullExtrinsic.signer,
      memberCount,
      proposal_id: proposalId,
      module,
      call,
    },
  }

  await governanceRepository.council.save(proposalModel)
}

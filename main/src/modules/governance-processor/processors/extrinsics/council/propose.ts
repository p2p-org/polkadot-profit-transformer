import { Logger } from 'apps/common/infra/logger/logger'
import { ExtrincicProcessorInput } from '..'
import { Call, H256, Hash } from '@polkadot/types/interfaces'
import { Compact, u32 } from '@polkadot/types'
import { findEvent } from '../../utils/findEvent'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { CouncilProposalModel } from 'apps/common/infra/postgresql/models/councilMotions.model'

export const processCouncilProposeExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { events, extrinsic } = args

  const councilProposedEvent = findEvent(events, 'council', 'Proposed')

  if (councilProposedEvent) {
    const eventData = councilProposedEvent.event.data
    const ProposalIndex = (<u32>eventData[1]).toNumber()
    const motionHash = (<Hash>eventData[2]).toString()
    const threshold = (<u32>eventData[3]).toNumber()

    const proposalArg = <Call>extrinsic.args[1]

    console.log('TOJSON', extrinsic.args[1].toJSON())

    const length_bound = <Compact<u32>>extrinsic.args[2]

    const proposal = {
      call_module: proposalArg.section,
      call_name: proposalArg.method,
      ...proposalArg.toJSON(),
    }

    const proposalModel: CouncilProposalModel = {
      id: ProposalIndex,
      hash: motionHash,
      block_id: extrinsic.block_id,
      event_id: '',
      extrinsic_id: extrinsic.id,
      event: 'Proposed',
      data: {
        signer: extrinsic.signer,
        threshold,
        proposal,
        length_bound,
      },
    }

    await governanceRepository.council.save(proposalModel)
    return
  }

  const councilExecutedEvent = findEvent(events, 'council', 'Executed')
  if (councilExecutedEvent) {
    const eventData = councilExecutedEvent.event.data
    const hash = (<H256>eventData[0]).toString()

    const proposalModel: CouncilProposalModel = {
      id: -1,
      hash,
      block_id: extrinsic.block_id,
      event_id: '',
      extrinsic_id: extrinsic.id,
      event: 'Proposed/Executed',
      data: {},
    }

    await governanceRepository.council.save(proposalModel)
  }
}

import { ApiPromise } from '@polkadot/api'
import { GovernanceRepository } from '../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { ExtrincicProcessorInput } from '..'
import { CouncilProposalModel } from 'apps/common/infra/postgresql/governance/models/councilMotions.model'
import { Call, Hash } from '@polkadot/types/interfaces'
import { Compact, u32 } from '@polkadot/types'

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
  const threshold = (<u32>eventData[3]).toNumber()

  const proposalArg = <Call>fullExtrinsic.method.args[1]

  console.log('TOJSON', fullExtrinsic.method.args[1].toJSON())

  const length_bound = <Compact<u32>>fullExtrinsic.args[2]

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
      signer: fullExtrinsic.signer.toString(),
      threshold,
      proposal,
      length_bound,
    },
  }

  await governanceRepository.council.save(proposalModel)
}

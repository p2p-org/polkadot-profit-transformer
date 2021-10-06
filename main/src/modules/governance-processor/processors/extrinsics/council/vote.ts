import { Logger } from 'apps/common/infra/logger/logger'
import { findEvent } from '../../utils/findEvent'
import { AccountId, Hash, MemberCount, ProposalIndex } from '@polkadot/types/interfaces'
import { bool, Compact } from '@polkadot/types'
import { ExtrincicProcessorInput } from '..'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance/governance.repository'
import { CouncilProposalModel } from 'apps/common/infra/postgresql/governance/models/councilMotions.model'

export const processCouncilProposalVoteExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { extrinsicEvents, fullExtrinsic, extrinsic, block } = args

  logger.info({ extrinsic }, 'process council vote extrinsic')

  const councilVotedEvent = findEvent(extrinsicEvents, 'council', 'Voted')
  if (!councilVotedEvent) throw Error('no council voted event for enrty ' + extrinsic.id)

  const eventData = councilVotedEvent.event.data
  const accountId = (<AccountId>eventData[0]).toString()
  const membersYes = (<MemberCount>eventData[3]).toNumber()
  const membersNo = (<MemberCount>eventData[4]).toNumber()

  const proposalHash = (<Hash>fullExtrinsic.args[0]).toString()
  const proposalIndex = (<Compact<ProposalIndex>>fullExtrinsic.args[1]).toNumber()
  const approve = <bool>fullExtrinsic.args[2]

  const votedModel: CouncilProposalModel = {
    id: proposalIndex,
    hash: proposalHash,
    block_id: block.block.header.number.toNumber(),
    event: 'Vote',
    data: {
      voter: accountId,
      approve: approve,
      membersYes: membersYes,
      membersNo: membersNo,
    },
    extrinsic_id: extrinsic.id,
    event_id: '',
  }

  console.log({ votedModel })

  await governanceRepository.council.save(votedModel)
}

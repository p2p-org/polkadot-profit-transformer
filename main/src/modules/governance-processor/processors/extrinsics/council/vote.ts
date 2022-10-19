import { Logger } from 'loaders/logger'
import { findEvent } from '../../utils/findEvent'
import { AccountId, Hash, MemberCount, ProposalIndex } from '@polkadot/types/interfaces'
import { bool, Compact } from '@polkadot/types'
import { ExtrincicProcessorInput } from '..'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { CouncilProposalModel } from '@/models/councilMotions.model'

export const processCouncilProposalVoteExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { events, extrinsic, block } = args

  logger.info({ extrinsic }, 'process council vote extrinsic')

  const councilVotedEvent = findEvent(events, 'council', 'Voted')

  let accountId, membersYes, membersNo

  if (councilVotedEvent) {
    const eventData = councilVotedEvent.event.data
    accountId = (<AccountId>eventData[0]).toString()
    membersYes = (<MemberCount>eventData[3]).toNumber()
    membersNo = (<MemberCount>eventData[4]).toNumber()
    logger.error('no council vote event found for extrinsic ' + extrinsic.id)
  }

  const proposalHash = (<Hash>extrinsic.args[0]).toString()
  const proposalIndex = (<Compact<ProposalIndex>>extrinsic.args[1]).toNumber()
  const approve = <bool>extrinsic.args[2]

  const votedModel: CouncilProposalModel = {
    id: proposalIndex,
    hash: proposalHash,
    block_id: block.id,
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

  // console.log({ votedModel })

  await governanceRepository.council.save(votedModel)
}

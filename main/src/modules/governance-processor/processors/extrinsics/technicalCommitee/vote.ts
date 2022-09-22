import { Logger } from 'loaders/logger'
import { findEvent } from '../../utils/findEvent'
import { AccountId, Hash, MemberCount, ProposalIndex } from '@polkadot/types/interfaces'
import { bool, Compact } from '@polkadot/types'
import { ExtrincicProcessorInput } from '..'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { TechnicalCommiteeProposalModel } from '@/models/technicalCommittee.model'

export const processTechnicalCommiteeVoteExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { events, extrinsic } = args

  logger.info({ extrinsic }, 'processTechnicalCommiteeVoteExtrinsic')

  const techCommVotedEvent = findEvent(events, 'technicalCommittee', 'Voted')
  if (!techCommVotedEvent) {
    logger.error('no technicalcommittee voted event for enrty ' + extrinsic.id)
    return
  }

  const proposalHash = <Hash>extrinsic.args[0]
  const proposalIndex = <Compact<ProposalIndex>>extrinsic.args[1]
  const approve = <bool>extrinsic.args[2]
  const accountId = <AccountId>techCommVotedEvent.event.data[0]
  const membersYes = <MemberCount>techCommVotedEvent.event.data[3]
  const membersNo = <MemberCount>techCommVotedEvent.event.data[4]

  const proposalModel: TechnicalCommiteeProposalModel = {
    id: proposalIndex.toNumber(),
    hash: proposalHash.toString(),
    block_id: extrinsic.block_id,
    event: 'Vote',
    data: {
      voter: accountId.toString(),
      approve: approve,
      membersYes: membersYes.toNumber(),
      membersNo: membersNo.toNumber(),
    },
    extrinsic_id: extrinsic.id,
    event_id: '',
  }

  console.log({ proposalModel })

  await governanceRepository.technicalCommittee.save(proposalModel)
}

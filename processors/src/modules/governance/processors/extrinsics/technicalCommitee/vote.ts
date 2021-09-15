import { findExtrinic } from '../../utils/findExtrinsic'
import { ApiPromise } from '@polkadot/api'
import { TechnicalCommiteeProposalModel } from '../../../../../apps/common/infra/postgresql/governance/models/technicalCommiteeModels'
import { Extrinsic } from './../../../types'
import { GovernanceRepository } from './../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { findEvent } from '../../utils/findEvent'
import { AccountId, Hash, MemberCount, ProposalIndex } from '@polkadot/types/interfaces'
import { bool, Compact } from '@polkadot/types'
import { ExtrincicProcessorInput } from '..'

export const processTechnicalCommiteeVoteExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { blockEvents, extrinsicFull, extrinsic } = args

  logger.info({ extrinsic }, 'processTechnicalCommiteeVoteExtrinsic')

  const techCommVotedEvent = findEvent(blockEvents, 'technicalCommittee', 'Voted')
  if (!techCommVotedEvent) throw Error('no technicalcommittee voted event for enrty ' + extrinsic.id)

  const proposalHash = <Hash>extrinsicFull.args[0]
  const proposalIndex = <Compact<ProposalIndex>>extrinsicFull.args[1]
  const approve = <bool>extrinsicFull.args[2]
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
    event_id: 'vote',
  }

  console.log({ proposalModel })

  await governanceRepository.technicalCommittee.save(proposalModel)
}

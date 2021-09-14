import { findExtrinic } from '../../utils/findExtrinsic'
import { ApiPromise } from '@polkadot/api'
import { TechnicalCommiteeProposalModel } from '../../../../../apps/common/infra/postgresql/governance/models/technicalCommiteeModels'
import { Extrinsic } from './../../../types'
import { GovernanceRepository } from './../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { isExtrinsicSuccess } from '../../utils/isExtrinsicSuccess'
import { findEvent } from '../../utils/findEvent'
import { AccountId, Hash, MemberCount, Proposal, ProposalIndex } from '@polkadot/types/interfaces'
import { bool, Compact } from '@polkadot/types'

export const processTechnicalCommiteeVoteExtrinsic = async (
  extrinsic: Extrinsic,
  governanceRepository: GovernanceRepository,
  logger: Logger,
  polkadotApi: ApiPromise,
): Promise<void> => {
  logger.info({ extrinsic }, 'processTechnicalCommiteeVoteExtrinsic')

  const blockHash = await polkadotApi.rpc.chain.getBlockHash(extrinsic.block_id)
  const blockEvents = await polkadotApi.query.system.events.at(blockHash)

  const isExtrinsicSuccessfull = await isExtrinsicSuccess(extrinsic, blockEvents, polkadotApi)
  if (!isExtrinsicSuccessfull) {
    logger.warn('extrinsic fail:' + extrinsic.id)
    return
  }

  const block = await polkadotApi.rpc.chain.getBlock(blockHash)

  const extrinsicFull = await findExtrinic(block, 'technicalCommittee', 'vote', polkadotApi)
  if (!extrinsicFull) throw Error('no full extrinsic for enrty ' + extrinsic.id)

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

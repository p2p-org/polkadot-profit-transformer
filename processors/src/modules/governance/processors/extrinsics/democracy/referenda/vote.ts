import { ApiPromise } from '@polkadot/api'
import { DemocracyReferendaModel } from '../../../../../../apps/common/infra/postgresql/governance/models/democracyModels'
import { Extrinsic } from '../../../../types'
import { GovernanceRepository } from '../../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { AccountVote, EventRecord } from '@polkadot/types/interfaces'

export const processDemocracyReferendaVoteExtrinsic = async (
  extrinsic: Extrinsic,
  governanceRepository: GovernanceRepository,
  logger: Logger,
  polkadotApi: ApiPromise,
): Promise<void> => {
  // here preimage proposal_hash appears first time, add record to the proposal_image table

  console.log({ extrinsic })

  logger.info({ extrinsic }, 'processDemocracyReferendaVoteExtrinsic')

  const blockHash = await polkadotApi.rpc.chain.getBlockHash(extrinsic.block_id)
  const signedBlock = await polkadotApi.rpc.chain.getBlock(blockHash)

  const blockEvents = await polkadotApi.query.system.events.at(blockHash)

  const extrinsicIndex = +extrinsic.id.split('-')[1]

  const events = blockEvents.filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(extrinsicIndex))

  const isExtrinsicSuccess = async (events: EventRecord[]): Promise<boolean> => {
    for (const event of events) {
      const success = await polkadotApi.events.system.ExtrinsicSuccess.is(event.event)
      if (success) return true
    }
    return false
  }

  const success = await isExtrinsicSuccess(events)

  if (!success) {
    logger.warn('extrinsic fail: ' + extrinsic.id)
    return
  }

  const voteExtrinsic = signedBlock.block.extrinsics.find((ext) => ext.method.section === 'democracy' && ext.method.method === 'vote')

  if (!voteExtrinsic) {
    logger.warn('no democracy.vote extrinsic found in block ' + extrinsic.block_id)
    return
  }
  const referendumIndex = <number>(<unknown>voteExtrinsic.args[0])

  const vote = <AccountVote>voteExtrinsic!.args[1]

  console.log('vote', vote.asStandard.vote.toHuman())
  console.log('balance', vote.asStandard.balance.toNumber())
  console.log('conviction', vote.asStandard.vote.conviction.toNumber())

  const referenda: DemocracyReferendaModel = {
    id: referendumIndex,
    block_id: extrinsic.block_id,
    event_id: '',
    extrinsic_id: extrinsic.id,
    event: 'Voted',
    data: {
      sender: extrinsic.signer,
      vote: vote.asStandard.vote.isAye ? 'Aye' : 'Nay',
      conviction: vote.asStandard.vote.conviction.toNumber(),
      balance: vote.asStandard.balance.toNumber(),
    },
  }

  return governanceRepository.democracy.referenda.save(referenda)
}

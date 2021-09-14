import { ApiPromise } from '@polkadot/api'
import { DemocracyReferendaModel } from '../../../../../../apps/common/infra/postgresql/governance/models/democracyModels'
import { Extrinsic } from '../../../../types'
import { GovernanceRepository } from '../../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { AccountVote, EventRecord, ReferendumIndex, Vote } from '@polkadot/types/interfaces'
import { isExtrinsicSuccess } from '../../../utils/isExtrinsicSuccess'
import { findExtrinic } from '../../../utils/findExtrinsic'
import { Compact } from '@polkadot/types'

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
  const blockEvents = await polkadotApi.query.system.events.at(blockHash)

  const isExtrinsicSuccessfull = await isExtrinsicSuccess(extrinsic, blockEvents, polkadotApi)
  if (!isExtrinsicSuccessfull) return

  const block = await polkadotApi.rpc.chain.getBlock(blockHash)

  const extrinsicFull = await findExtrinic(block, 'democracy', 'vote', polkadotApi)
  if (!extrinsicFull) throw Error('no full extrinsic for enrty ' + extrinsic.id)

  console.log({ extrinsicFull })

  const referendumIndex = <Compact<ReferendumIndex>>extrinsicFull.args[0]

  const voteRaw = <AccountVote>extrinsicFull.method.args[1]

  const decodeVote = (v: AccountVote) => {
    if (!v.isStandard) {
      const vote = v.toHuman() as { vote: string }
      return { vote: vote['vote'], conviction: 0, balance: 0 }
    }

    // if (v.isStandard) {
    const vote = v.asStandard.vote.isAye ? 'Aye' : 'Nay'
    const conviction = v.asStandard.vote.conviction.toNumber()
    const balance = v.asStandard.balance.toNumber()
    return { vote, conviction, balance }
    // }
  }

  const { vote, conviction, balance } = decodeVote(voteRaw)

  // console.log('vote', vote.asStandard.vote.toHuman())
  // console.log('balance', vote.asStandard.balance.toNumber())
  // console.log('conviction', vote.asStandard.vote.conviction.toNumber())

  const referenda: DemocracyReferendaModel = {
    id: referendumIndex.toNumber(),
    block_id: extrinsic.block_id,
    event_id: '',
    extrinsic_id: extrinsic.id,
    event: 'Voted',
    data: {
      voter: extrinsic.signer,
      vote,
      conviction,
      balance,
    },
  }

  return governanceRepository.democracy.referenda.save(referenda)
}

import { DemocracyReferendaModel } from '../../../../../../apps/common/infra/postgresql/governance/models/democracyModels'
import { GovernanceRepository } from '../../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { AccountVote, ReferendumIndex } from '@polkadot/types/interfaces'
import { Compact } from '@polkadot/types'
import { ExtrincicProcessorInput } from '../..'

export const processDemocracyReferendaVoteExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  // here preimage proposal_hash appears first time, add record to the proposal_image table
  const { fullExtrinsic, extrinsic } = args

  logger.info({ extrinsic }, 'processDemocracyReferendaVoteExtrinsic')

  const referendumIndex = <Compact<ReferendumIndex>>fullExtrinsic.args[0]

  const voteRaw = <AccountVote>fullExtrinsic.args[1]

  const decodeVote = (v: AccountVote) => {
    if (!v.isStandard) {
      const vote = v.toHuman() as { vote: string }
      return { vote: vote['vote'], conviction: 0, balance: 0 }
    }

    // if (v.isStandard)
    const vote = v.asStandard.vote.isAye ? 'Aye' : 'Nay'
    const conviction = v.asStandard.vote.conviction.toNumber()
    const balance = v.asStandard.balance.toNumber()
    return { vote, conviction, balance }
  }

  const { vote, conviction, balance } = decodeVote(voteRaw)

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

import { Logger } from 'loaders/logger'
import { ExtrincicProcessorInput } from '../..'
import { u32 } from '@polkadot/types'
import { AccountId32 } from '@polkadot/types/interfaces'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'

export const processDemocracyReferendaRemoveOtherVoteExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { extrinsic } = args

  logger.info({ extrinsic }, 'processDemocracyReferendaRemoveOtherVoteExtrinsic')

  const referendumIndex = <u32>extrinsic.args[1]
  const target = <AccountId32>extrinsic.args[0]

  const vote = await governanceRepository.democracy.referenda.findVote(referendumIndex, target)

  if (!vote) {
    // todo leave error
    return
    // throw Error('No vote found for removeVote extrinsic ' + extrinsic.id)
  }

  return governanceRepository.democracy.referenda.removeVote(vote)
}

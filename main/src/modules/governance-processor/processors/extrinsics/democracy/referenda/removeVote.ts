import { Logger } from 'apps/common/infra/logger/logger'
import { ExtrincicProcessorInput } from '../..'
import { u32 } from '@polkadot/types'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'

export const processDemocracyReferendaRemoveVoteExtrinsic = async (
  args: ExtrincicProcessorInput,

  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { extrinsic } = args

  logger.info({ extrinsic }, 'processDemocracyReferendaRemoveVoteExtrinsic')

  const referendumIndex = <u32>extrinsic.args[0]
  const voter = extrinsic.signer!

  const vote = await governanceRepository.democracy.referenda.findVote(referendumIndex, voter)

  if (!vote) {
    // todo leave error
    return
  }

  return governanceRepository.democracy.referenda.removeVote(vote)
}

import { Address } from '@polkadot/types/interfaces'
import { GovernanceRepository } from '../../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { ExtrincicProcessorInput } from '../..'
import { u32 } from '@polkadot/types'

export const processDemocracyReferendaRemoveVoteExtrinsic = async (
  args: ExtrincicProcessorInput,

  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { fullExtrinsic, extrinsic } = args

  logger.info({ extrinsic }, 'processDemocracyReferendaRemoveVoteExtrinsic')

  const referendumIndex = <u32>fullExtrinsic.args[0]
  const voter: Address = fullExtrinsic.signer

  const vote = await governanceRepository.democracy.referenda.findVote(referendumIndex, voter)

  if (!vote) {
    // todo leave error
    return
    throw Error('No vote found for removeVote extrinsic ' + extrinsic.id)
  }

  return governanceRepository.democracy.referenda.removeVote(vote)
}

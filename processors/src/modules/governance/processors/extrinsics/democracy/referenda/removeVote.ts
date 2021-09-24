import { DemocracyReferendaModel } from '../../../../../../apps/common/infra/postgresql/governance/models/democracyModels'
import { GovernanceRepository } from '../../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { ExtrincicProcessorInput } from '../..'

export const processDemocracyReferendaRemoveVoteExtrinsic = async (
  args: ExtrincicProcessorInput,

  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { extrinsicEvents, fullExtrinsic, extrinsic } = args

  logger.info({ extrinsic }, 'processDemocracyReferendaRemoveVoteExtrinsic')

  const referendumIndex = <number>(<unknown>fullExtrinsic.args[0])

  console.log('ref index', referendumIndex)

  const referenda: DemocracyReferendaModel = {
    id: referendumIndex,
    block_id: extrinsic.block_id,
    event_id: '',
    extrinsic_id: extrinsic.id,
    event: 'VoteRemoved',
    data: {
      sender: extrinsic.signer,
    },
  }

  return governanceRepository.democracy.referenda.save(referenda)
}

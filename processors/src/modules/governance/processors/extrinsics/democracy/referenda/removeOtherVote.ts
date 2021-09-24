import { DemocracyReferendaModel } from '../../../../../../apps/common/infra/postgresql/governance/models/democracyModels'
import { GovernanceRepository } from '../../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { ExtrincicProcessorInput } from '../..'

export const processDemocracyReferendaRemoveOtherVoteExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { fullExtrinsic, extrinsic } = args

  logger.info({ extrinsic }, 'processDemocracyReferendaRemoveOtherVoteExtrinsic')

  const referendumIndex = +fullExtrinsic.args[1].toString()
  const target = fullExtrinsic.args[0].toString()

  console.log('ref index', referendumIndex)

  const referenda: DemocracyReferendaModel = {
    id: referendumIndex,
    block_id: extrinsic.block_id,
    event_id: '',
    extrinsic_id: extrinsic.id,
    event: 'OtherVoteRemoved',
    data: {
      voter: target,
    },
  }

  return governanceRepository.democracy.referenda.save(referenda)
}

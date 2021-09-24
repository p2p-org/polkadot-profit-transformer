import { DemocracyProposalModel } from '../../../../../../apps/common/infra/postgresql/governance/models/democracyModels'
import { GovernanceRepository } from '../../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { ExtrincicProcessorInput } from '../..'

export const processDemocracyProposalSecondExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
): Promise<void> => {
  const { extrinsicEvents, fullExtrinsic, extrinsic } = args

  console.log('PROPOSAL SECOND')
  console.log('EXTRINSIC', JSON.stringify(extrinsic, null, 2))

  // find balance reserved for this seconding

  const balanceReserverdEvent = extrinsicEvents.find((event) => {
    return event.event.section === 'balances' && event.event.method === 'Reserved'
  })

  if (!balanceReserverdEvent) {
    logger.warn('no balance.reserved event for extrinsic ' + extrinsic.id)
    return
  }

  console.log('balanceReserverdEvent', balanceReserverdEvent.toHuman())

  const proposalId = extrinsic.args[0] as number
  const seconds_upper_bound = (extrinsic.args[1] as number) ?? null

  const balanceReserved = parseInt(balanceReserverdEvent.event.data[1].toHex(), 16)

  const proposal: DemocracyProposalModel = {
    id: proposalId,
    hash: '',
    block_id: extrinsic.block_id,
    event_id: '',
    extrinsic_id: extrinsic.id,
    event: 'Second',
    data: { signer: extrinsic.signer, seconds_upper_bound, balanceReserved },
  }

  await governanceRepository.democracy.proposal.save(proposal)
}

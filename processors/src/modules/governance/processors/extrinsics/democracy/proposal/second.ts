import { DemocracyProposalModel } from '../../../../../../apps/common/infra/postgresql/governance/models/democracyModels'
import { ApiPromise } from '@polkadot/api'
import { Extrinsic } from '../../../../types'
import { GovernanceRepository } from '../../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { EventRecord } from '@polkadot/types/interfaces'

export const processDemocracyProposalSecondExtrinsic = async (
  extrinsic: Extrinsic,
  governanceRepository: GovernanceRepository,
  logger: Logger,
  polkadotApi: ApiPromise,
): Promise<void> => {
  console.log('PROPOSAL SECOND')
  console.log('EXTRINSIC', JSON.stringify(extrinsic, null, 2))

  const blockHash = await polkadotApi.rpc.chain.getBlockHash(extrinsic.block_id)
  const allRecords = await polkadotApi.query.system.events.at(blockHash)

  const extrinsicIndex = +extrinsic.id.split('-')[1]
  console.log({ extrinsicIndex })

  const events = allRecords.filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(extrinsicIndex))

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

  // find balance reserved for this seconding

  const balanceReserverdEvent = events.find((event) => {
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

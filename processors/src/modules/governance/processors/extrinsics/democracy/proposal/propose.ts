import { DemocracyProposalModel } from './../../../../../../apps/common/infra/postgresql/governance/models/democracyModels'
import { ApiPromise } from '@polkadot/api'
import { Extrinsic } from '../../../../types'
import { GovernanceRepository } from '../../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { EventRecord } from '@polkadot/types/interfaces'

export const processDemocracyProposalProposeExtrinsic = async (
  extrinsic: Extrinsic,
  governanceRepository: GovernanceRepository,
  logger: Logger,
  polkadotApi: ApiPromise,
): Promise<void> => {
  console.log('PROPOSAL PROPOSE')
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

  const democracyProposedEvent = events.find((event) => {
    return event.event.section === 'democracy' && event.event.method === 'Proposed'
  })
  // const treasuryDepositEvent = events.find((event) => event.event.method === 'treasury' && event.event.section === 'Deposit')

  if (!democracyProposedEvent) {
    logger.warn('no democracy proposed event for extrinsic ' + extrinsic.id)
    return
  }

  const proposalId = parseInt(democracyProposedEvent?.event.data[0].toHex(), 16)

  const balance = democracyProposedEvent?.event.data[1].toJSON()

  console.log({ balance })

  const proposal: DemocracyProposalModel = {
    id: proposalId,
    hash: extrinsic.args[0],
    block_id: extrinsic.block_id,
    event_id: '',
    extrinsic_id: extrinsic.id,
    event: 'Proposed',
    data: { balance: balance, signer: extrinsic.signer },
  }

  await governanceRepository.democracy.proposal.save(proposal)
}

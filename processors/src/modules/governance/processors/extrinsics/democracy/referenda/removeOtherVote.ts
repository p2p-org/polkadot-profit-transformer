import { ApiPromise } from '@polkadot/api'
import { DemocracyReferendaModel } from '../../../../../../apps/common/infra/postgresql/governance/models/democracyModels'
import { Extrinsic } from '../../../../types'
import { GovernanceRepository } from '../../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { EventRecord } from '@polkadot/types/interfaces'

export const processDemocracyReferendaRemoveOtherVoteExtrinsic = async (
  extrinsic: Extrinsic,
  governanceRepository: GovernanceRepository,
  logger: Logger,
  polkadotApi: ApiPromise,
): Promise<void> => {
  logger.info({ extrinsic }, 'processDemocracyReferendaRemoveOtherVoteExtrinsic')

  const blockHash = await polkadotApi.rpc.chain.getBlockHash(extrinsic.block_id)
  const signedBlock = await polkadotApi.rpc.chain.getBlock(blockHash)

  const blockEvents = await polkadotApi.query.system.events.at(blockHash)

  const extrinsicIndex = +extrinsic.id.split('-')[1]

  const events = blockEvents.filter(({ phase }) => phase.isApplyExtrinsic && phase.asApplyExtrinsic.eq(extrinsicIndex))

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

  const removeVoteExtrinsic = signedBlock.block.extrinsics.find(
    (ext) => ext.method.section === 'democracy' && ext.method.method === 'removeOtherVote',
  )

  if (!removeVoteExtrinsic) {
    logger.warn('no democracy.removeOtherVote extrinsic found in block ' + extrinsic.block_id)
    return
  }
  const referendumIndex = <number>(<unknown>removeVoteExtrinsic.args[1])
  const target = <string>(<unknown>removeVoteExtrinsic.args[0])

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

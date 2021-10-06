import { ApiPromise } from '@polkadot/api'
import { EventEntry } from '@modules/governance-processor/types'
import { Logger } from 'apps/common/infra/logger/logger'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance/governance.repository'
import { DemocracyReferendaModel } from 'apps/common/infra/postgresql/governance/models/democracy.model'
import { Hash, ProposalIndex, ReferendumIndex, VoteThreshold } from '@polkadot/types/interfaces'
import { Compact } from '@polkadot/types'

export const processDemocracyReferendaStarted = async (
  event: EventEntry,
  governanceRepository: GovernanceRepository,
  logger: Logger,
  polkadotApi: ApiPromise,
): Promise<void> => {
  const blockHash = await polkadotApi.rpc.chain.getBlockHash(event.block_id)
  const blockEvents = await polkadotApi.query.system.events.at(blockHash)
  const block = await polkadotApi.rpc.chain.getBlock(blockHash)

  console.log('democracy started event')

  const startedEvent = blockEvents.find((event) => {
    return event.event.section === 'democracy' && event.event.method === 'Started'
  })

  if (!startedEvent) {
    logger.error('no democracy started event found for incoming entry ' + event.event_id)
    return
  }

  // console.log({
  //   asApply: startedEvent.phase.asApplyExtrinsic.toHuman(),
  //   isApply: startedEvent.phase.isApplyExtrinsic,
  //   phase: startedEvent.phase.toHuman(),
  // })

  const referendumIndex = <ReferendumIndex>startedEvent.event.data[0]
  const threshold = <VoteThreshold>startedEvent.event.data[1]

  // if extrinsic applied then referenda is from technicalcommitee executed proposal
  // todo check fact above
  if (startedEvent.phase.isApplyExtrinsic) {
    const extrinsicIndex = startedEvent.phase.asApplyExtrinsic.toNumber()

    const extrinsic = block.block.extrinsics[extrinsicIndex]
    const hash = <Hash>extrinsic.args[0]
    const proposalIndex = <Compact<ProposalIndex>>extrinsic.args[1]

    const democracyReferenda: DemocracyReferendaModel = {
      id: referendumIndex.toNumber(),
      block_id: event.block_id,
      event_id: event.event_id,
      extrinsic_id: event.block_id + '-' + extrinsicIndex,
      event: 'Started',
      data: { threshold, motion_hash: hash, technical_committee_proposal_index: proposalIndex },
    }

    await governanceRepository.democracy.referenda.save(democracyReferenda)

    return
  }

  // else referendum started from a democracy proposal
  // we process this event in democracy.tabled event to catch democracy proposal and started referenda
}

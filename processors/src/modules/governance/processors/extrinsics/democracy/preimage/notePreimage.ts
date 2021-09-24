import { ApiPromise } from '@polkadot/api'
import { GovernanceRepository } from '../../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { AccountId, Balance, Call, Hash } from '@polkadot/types/interfaces'
import { Bytes } from '@polkadot/types'
import { findEvent } from '../../../utils/findEvent'
import { PreimageModel } from 'apps/common/infra/postgresql/governance/models/preimageModel'
import { ExtrincicProcessorInput } from '../..'

export const processDemocracyNotePreimageExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
  polkadotApi: ApiPromise,
): Promise<void> => {
  const { extrinsicEvents, fullExtrinsic, extrinsic, block } = args

  const preimageNotedEvent = findEvent(extrinsicEvents, 'democracy', 'PreimageNoted')
  if (!preimageNotedEvent) throw Error('no  PreimageNoted event for enrty ' + extrinsic.id)

  const encoded_proposal = <Bytes>fullExtrinsic.args[0]

  const proposalHash = <Hash>preimageNotedEvent.event.data[0]
  const accountId = <AccountId>preimageNotedEvent.event.data[1]
  const deposit = <Balance>preimageNotedEvent.event.data[2]

  // here we decode preimage method and call

  // console.log({
  //   blockHash: block.block.hash.toString(),
  //   proposalHash: proposalHash.toHuman(),
  // })

  const api = await polkadotApi.at(block.block.hash)

  const preimageWrapped = await api.query.democracy.preimages(proposalHash)
  // console.log('preimage', preimageWrapped)
  const preimage = preimageWrapped.unwrap()

  let call: Call

  if (preimage.isAvailable) {
    // console.log('isAvailable')
    call = await polkadotApi.createType('Call', preimage.asAvailable.data)
  } else {
    // console.log('not available')
    call = await polkadotApi.createType('Call', (<any>preimage)[0])
  }

  const preimageRecord: PreimageModel = {
    proposal_hash: proposalHash.toString(),
    block_id: extrinsic.block_id,
    event_id: 'noted',
    extrinsic_id: extrinsic.id,
    event: 'preimageNoted',
    data: {
      deposit: deposit.toNumber(),
      accountId,
      encoded_proposal,
      image: call,
    },
  }

  await governanceRepository.preimages.save(preimageRecord)
}

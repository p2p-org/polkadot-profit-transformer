import { ApiPromise } from '@polkadot/api'
import { Logger } from 'loaders/logger'
import { AccountId, Balance, Call, Hash } from '@polkadot/types/interfaces'
import { Bytes } from '@polkadot/types'
import { findEvent } from '../../../utils/findEvent'
import { ExtrincicProcessorInput } from '../..'
import { GovernanceRepository } from 'apps/common/infra/postgresql/governance.repository'
import { PreimageModel } from 'apps/common/infra/postgresql/models/preimage.model'
import '@polkadot/api-augment'

export const processDemocracyNotePreimageExtrinsic = async (
  args: ExtrincicProcessorInput,
  governanceRepository: GovernanceRepository,
  logger: Logger,
  polkadotApi: ApiPromise,
): Promise<void> => {
  const { events, extrinsic, block } = args

  const preimageNotedEvent = findEvent(events, 'democracy', 'PreimageNoted')
  if (!preimageNotedEvent) throw Error('no  PreimageNoted event for enrty ' + extrinsic.id)

  const encoded_proposal = <Bytes>extrinsic.args[0]

  const proposalHash = (<Hash>preimageNotedEvent.event.data[0]).toString()
  const accountId = (<AccountId>preimageNotedEvent.event.data[1]).toString()
  const deposit = (<Balance>preimageNotedEvent.event.data[2]).toString()

  // here we decode preimage method and call

  // console.log({
  //   blockHash: block.block.hash.toString(),
  //   proposalHash: proposalHash.toHuman(),
  // })

  const api = await polkadotApi.at(block.hash)

  const preimageWrapped = await api.query.democracy.preimages(proposalHash)
  const preimage = preimageWrapped.unwrap()

  let call: Call | null

  if (preimage.isAvailable) {
    // todo fix kusama block # 5053432 preimage decoding issue
    try {
      call = await polkadotApi.registry.createType('Call', preimage.asAvailable.data)
    } catch (error) {
      call = null
    }
  } else {
    // console.log('not available')
    // todo : old image decode
    // call = await polkadotApi.createType('Call', (<any>preimage)[0])
    call = null
  }

  const preimageRecord: PreimageModel = {
    proposal_hash: proposalHash,
    block_id: extrinsic.block_id,
    event_id: '',
    extrinsic_id: extrinsic.id,
    event: 'preimageNoted',
    data: {
      deposit: deposit,
      accountId,
      encoded_proposal,
      image: call,
    },
  }

  await governanceRepository.preimages.save(preimageRecord)
}

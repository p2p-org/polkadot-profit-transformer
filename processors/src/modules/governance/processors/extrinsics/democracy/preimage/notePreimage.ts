import { ApiPromise } from '@polkadot/api'
import { GovernanceRepository } from '../../../../../../apps/common/infra/postgresql/governance/governance.repository'
import { Logger } from 'apps/common/infra/logger/logger'
import { AccountId, Balance, Hash } from '@polkadot/types/interfaces'
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
  const { blockEvents, extrinsicFull, extrinsic, block } = args

  const preimageNotedEvent = findEvent(blockEvents, 'democracy', 'PreimageNoted')
  if (!preimageNotedEvent) throw Error('no technicalcomdemocracymittee PreimageNoted event for enrty ' + extrinsic.id)

  const encoded_proposal = <Bytes>extrinsicFull.args[0]

  const proposalHash = <Hash>preimageNotedEvent.event.data[0]
  const accountId = <AccountId>preimageNotedEvent.event.data[1]
  const deposit = <Balance>preimageNotedEvent.event.data[2]

  // here we decode preimage method and call

  console.log('encoded', encoded_proposal.toHuman())

  console.log('blockhash, proposalhash', block.block.hash, proposalHash.toHuman())

  const preimageData = await polkadotApi.query.democracy.preimages.at(block.block.hash, proposalHash)
  console.log(preimageData.toHuman())

  const imagedata = polkadotApi.createType('Call', preimageData.unwrap().asAvailable.data)

  console.log(imagedata.toHuman())

  const preimageRecord: PreimageModel = {
    proposal_hash: proposalHash.toString(),
    block_id: extrinsic.block_id,
    event_id: 'noted',
    extrinsic_id: extrinsic.id,
    event: 'preimageNoted',
    data: { deposit: deposit.toNumber(), accountId, encoded_proposal, image: imagedata.toHuman() },
  }

  await governanceRepository.preimages.save(preimageRecord)
}

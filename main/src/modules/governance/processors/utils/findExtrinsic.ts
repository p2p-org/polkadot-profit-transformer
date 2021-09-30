import { Extrinsic } from './../../types'
import { ApiPromise } from '@polkadot/api'
import { GenericExtrinsic } from '@polkadot/types'
import { OpaqueCall, SignedBlock } from '@polkadot/types/interfaces'
import { AnyTuple } from '@polkadot/types/types'

export const findExtrinicAndEvents = async (
  block: SignedBlock,
  extrinsic: Extrinsic,
  blockEvents: 
  // polkadotApi?: ApiPromise,
): Promise<GenericExtrinsic<AnyTuple> | undefined> => {
  const extrinsicIndex = +extrinsic.id.split('-')[1]
  const fullExtrinsic = block.block.extrinsics[extrinsicIndex]

  if (!fullExtrinsic) return undefined

  // if no common extrinsic found, try to find in multisig extrinsic
  // todo process multisig extrinsics.
  // const multisigExtrinsic = block.block.extrinsics.find((ext) => ext.method.section === 'multisig' && ext.method.method === 'asMulti')

  // if (multisigExtrinsic) {
  //   const call = <OpaqueCall>multisigExtrinsic.method.args[3]

  //   const methods = polkadotApi.registry.createType('Call', call.toU8a(true))

  //   const ext = methods.args[2] as any

  //   console.log(
  //     ext.method,
  //     ext.section,
  //     ext.args.map((arg: any) => arg.toHuman()),
  //   )

  //   const mockedExtrinsic: any = {
  //     args: ext.args,
  //   }

  //   return mockedExtrinsic
  // }
}

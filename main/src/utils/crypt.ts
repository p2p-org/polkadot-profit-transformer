import { xxhashAsHex, blake2AsU8a } from '@polkadot/util-crypto'
import { decodeAddress } from '@polkadot/keyring'
import { u8aConcat, u8aToU8a } from '@polkadot/util'

export const encodeXxhashAsHex = (data: string): string => {
  return xxhashAsHex(data, 128).replace(/^0x/g, '')
}

export const encodeAccountIdToBlake2 = (accountId: string): string => {
  if (!accountId.length) return '';
  const uint8 = u8aConcat(blake2AsU8a(decodeAddress(accountId), 128), u8aToU8a(decodeAddress(accountId)))
  return Buffer.from(uint8).toString('hex')
}

export const encodeStorageKey = (module: string, method: string, param: string): string => {
  //                                                                   13UVJyLnbVp9RBZYFwFGyDvVd1y27Tt8tkntv6Q7JVPhFsTB
  //                                                                   5ecffd7b6c0f78751baa9d281e0bfa3a6d6f646c70792f74727372790000000000000000000000000000000000000000
  //0x26aa394eea5630e07c48ae0c9558cef7b99d880ec681799c0cf30e8886371da9 5ecffd7b6c0f78751baa9d281e0bfa3a
  //0x26aa394eea5630e07c48ae0c9558cef7b99d880ec681799c0cf30e8886371da9                                 6d6f646c70792f74727372790000000000000000000000000000000000000000

  return '0x' + encodeXxhashAsHex(module) + encodeXxhashAsHex(method) + encodeAccountIdToBlake2(param)
}

import * as scale from 'scale-codec'

export interface AccountBalance {
  nonce: number;
  consumers: number;
  providers: number;
  sufficients: number;
  data: {
    free: bigint;
    reserved: bigint;
    miscFrozen: bigint;
    feeFrozen: bigint;
  }
}

export const decodeAccountBalanceValue = (value: string): AccountBalance => {

  if (value === '00') {
    return {
      nonce: 0,
      consumers: 0,
      providers: 0,
      sufficients: 0,
      data: {
        free: BigInt(0),
        reserved: BigInt(0),
        miscFrozen: BigInt(0),
        feeFrozen: BigInt(0)
      }
    }
  }


  const ScaleAccountBalance = ((): any => {
    switch (value.length) {

      case 140:
        //Balance 1{ "nonce": 0, "refcount": 0, "data": { "free": "0x00000000000000000014cea15e380800", "reserved": 0, "miscFrozen": 0, "feeFrozen": 0 } }
        //0100000000000008385ea1ce14000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
        return scale.object(
          scale.field('nonce', scale.u32),
          scale.field('refcount', scale.u8),
          scale.field('data',
            scale.object(
              scale.field('free', scale.u128),
              scale.field('reserved', scale.u128),
              scale.field('miscFrozen', scale.u128),
              scale.field('feeFrozen', scale.u128)
            )
          ),
        )
      case 160:
        //00000000000000000100000000000000eaac1adc53b417060000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
        return scale.object(
          scale.field('nonce', scale.u32),
          scale.field('consumers', scale.u32),
          scale.field('providers', scale.u32),
          scale.field('sufficients', scale.u32),
          scale.field('data',
            scale.object(
              scale.field('free', scale.u128),
              scale.field('reserved', scale.u128),
              scale.field('miscFrozen', scale.u128),
              scale.field('feeFrozen', scale.u128)
            )
          ),
        )
      default:
        return null
    }
  })()

  const encodedBytes = new Uint8Array(Buffer.from(value, 'hex'))
  return ScaleAccountBalance.decode(encodedBytes)
}

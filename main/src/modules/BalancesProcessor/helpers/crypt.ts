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
        //01020000000000000080d37886020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
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

      /*
    case 146:
      //polkadot block 2005678
      //01020000000000000080d37886020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
      return scale.object(
        scale.field('nonce', scale.u32),
        scale.field('refcount', scale.u8),
        scale.field('refcount2', scale.u8), //maybe not correct.
        scale.field('data',
          scale.object(
            scale.field('free', scale.u128),
            scale.field('reserved', scale.u128),
            scale.field('miscFrozen', scale.u128),
            scale.field('feeFrozen', scale.u128)
          )
        ),
      )
      */


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
      case 162:
        //kusama: 17000137
        //01160e000000000000010000000000000003a8d752fe1400000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000
        //01000000000000000001000000000000000392c9ee4fe7d700000000000000000000c0d9bd16c8000000000000000000000000000000000000000000000000000000000000000000000000000000000000
        //0163000000000000000100000000000000cbeae28593f1382900000000000000000000f4224c06e3d730000000000000000000000000000000000000000000000000000000000000000000000000000000
        //moonbeam: 574323
        //account id - 0xe6584f948e5C9c1BDABf84dC5AF75b94019393f1
        //0x64000000000000000100000000000000cbba91e41f5e3f2900000000000000000000f4224c06e3d730000000000000000000000000000000000000000000000000000000000000000000000000000000
        return scale.object(
          scale.field('refcount2', scale.u8),
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
        throw new Error(`Unknown ScaleAccountBalance. Value is: ${value}. Value length: ${value.length}`)
    }
  })()

  //console.log("==============")
  const encodedBytes = new Uint8Array(Buffer.from(value, 'hex'))
  //console.log(encodedBytes)
  //console.log("++++++++++++++")
  //console.log(ScaleAccountBalance)
  return ScaleAccountBalance.decode(encodedBytes)
}

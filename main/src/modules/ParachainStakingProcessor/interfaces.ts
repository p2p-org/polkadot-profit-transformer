/* eslint-disable max-classes-per-file */
import type { u128, u32 } from '@polkadot/types-codec';
import { BN } from '@polkadot/util';
import type { HexString } from '@polkadot/util/types';
import { Moment } from '@polkadot/types/interfaces';

export type DelegatorReward = {
  id: string;
  reward: BN;
};

export type DelegatorInfo = {
  id: string;
  amount: u128;
  final_amount: u128;
  reward: BN;
};

export type CollatorReward = {
  // The percentage point share in Perbill of the collator
  collatorSharePerbill: BN;

  // Total rewarded
  total: BN;
  collator_teward: BN;
  // Contribution of commission rewards towards the total
  commissionReward: BN;
  // Contribution of bond rewards towards the total
  bondReward: BN;
  // Portion of rewards lost due to Perbill arithmetic (sum of bond shares not 100%)
  bondRewardLoss: BN;
};

export type Rewarded = {
  // Collator account id
  collator: HexString | null;
  // Set of delegator account ids
  delegators: Array<DelegatorReward>;
  // The rewarded amount
  amount: CollatorReward;
};

export type RoundValue = {
  id: BN,
  payoutBlockId: number,
  payoutBlockTime: Moment,
  startBlockId: number,
  startBlockTime: Moment,
  totalCollatorShare: BN,
  totalCollatorCommissionRewarded: BN,
  totalRewardedAmount: BN,
  totalPoints: BN,
  totalStaked: BN,
  totalBondRewarded: BN,
  specVersion: number,
  // totalBondRewardedLoss,
};

export type StakedValueData = {
  id: string;
  bond: u128;
  total: u128;
  points: u32;
  delegators: { [key: string]: DelegatorInfo };
  payoutBlockId?: u128;
  payoutBlockTime?: u128;
  reward?: CollatorReward;
};

export type StakedValue = {
  [key: string]: StakedValueData;
};

export class Perthing {
  private unit: BN;

  private perthing: BN;

  constructor(unit: BN, numerator: BN, denominator?: BN) {
    this.unit = unit;
    if (denominator) {
      this.perthing = numerator.mul(unit).div(denominator);
    } else {
      this.perthing = numerator;
    }
  }

  static divNearest(a: any, num: BN) {
    const dm = a.divmod(num);

    // Fast case - exact division
    if (dm.mod.isZero()) return dm.div;

    const mod = dm.div.negative !== 0 ? dm.mod.isub(num) : dm.mod;

    const half = num.ushrn(1);
    const r2 = num.andln(1) as any;
    const cmp = mod.cmp(half);

    // Round down
    if (cmp <= 0 || (r2 === 1 && cmp === 0)) return dm.div;

    // Round up
    return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
  }

  value(): BN {
    return this.perthing;
  }

  of(value: BN): BN {
    return Perthing.divNearest(this.perthing.mul(value), this.unit);
  }

  toString(): string {
    return `${this.perthing.toString()}`;
  }
}

export class Perbill extends Perthing {
  constructor(numerator: BN, denominator?: BN) {
    super(new BN(1_000_000_000), numerator, denominator);
  }
}

export class Percent extends Perthing {
  constructor(numerator: BN, denominator?: BN) {
    super(new BN(100), numerator, denominator);
  }
}

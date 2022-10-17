import { ApiPromise } from '@polkadot/api'
import { BN, BN_BILLION } from "@polkadot/util";
import Queue from 'better-queue'
const debug = console.log;

export const reward = async (api: ApiPromise, nowBlockNumber: number) => {
  console.log("---------------------------------")
  const latestBlock = await api.rpc.chain.getBlock();
  const latestBlockHash = latestBlock.block.hash;
  const latestBlockNumber = latestBlock.block.header.number.toNumber();
  const latestRound = await (await api.at(latestBlock.block.hash)).query.parachainStaking.round();
  const nowBlockHash = await api.rpc.chain.getBlockHash(nowBlockNumber);
  const nowRound = await (await api.at(nowBlockHash)).query.parachainStaking.round();
  const nowRoundNumber = nowRound.current;
  const nowRoundFirstBlock = nowRound.first;
  const nowRoundFirstBlockTime = await  (await api.at(nowBlockHash)).query.timestamp.now();
  const nowRoundFirstBlockHash = await api.rpc.chain.getBlockHash(nowRoundFirstBlock);
  const apiAtRewarded = await api.at(nowRoundFirstBlockHash);
  const rewardDelay = apiAtRewarded.consts.parachainStaking.rewardPaymentDelay;
  const priorRewardedBlockHash = await api.rpc.chain.getBlockHash(nowRoundFirstBlock.subn(1));
  const specVersion = (await apiAtRewarded.query.system.lastRuntimeUpgrade()).unwrap().specVersion.toNumber();

  // obtain data from original round
  const originalRoundNumber = (await apiAtRewarded.query.parachainStaking.round()).current.sub(
    rewardDelay
  );
  let iterOriginalRoundBlock = nowRoundFirstBlock.toBn();
  while (true) {
    const blockHash = await api.rpc.chain.getBlockHash(iterOriginalRoundBlock);
    const round = await (await api.at(blockHash)).query.parachainStaking.round();
    if (
      round.current.eq(originalRoundNumber) ||
      iterOriginalRoundBlock.sub(round.length).toNumber() < 0
    ) {
      break;
    }

    // go previous round
    iterOriginalRoundBlock = iterOriginalRoundBlock.sub(round.length);
  }
  // we go to the last block of the (original round - 1) since data is snapshotted at round start.
  const originalRoundPriorBlock = iterOriginalRoundBlock.subn(1);
  const originalRoundPriorBlockHash = await api.rpc.chain.getBlockHash(originalRoundPriorBlock);
  const apiAtOriginal = await api.at(originalRoundPriorBlockHash);
  const originalRoundPriorBlockTime = await apiAtOriginal.query.timestamp.now();
  const apiAtPriorRewarded = await api.at(priorRewardedBlockHash);

  debug(`
    latest  ${latestRound.current.toString()} (${latestBlockNumber} / ${latestBlockHash.toHex()})
    now     ${nowRound.current.toString()} (${nowBlockNumber} / ${nowBlockHash.toHex()})
    round   ${originalRoundNumber.toString()} (prior round last block \
    ${originalRoundPriorBlock} / ${originalRoundPriorBlockHash.toHex()})
    paid in ${nowRoundNumber.toString()} (first block \
    ${nowRoundFirstBlock.toNumber()} / ${nowRoundFirstBlockHash.toHex()} / prior \
    ${priorRewardedBlockHash.toHex()})
  `);

  // collect info about staked value from collators and delegators

  const {collators, delegators, stakedValue} = await getCollatorsAndDelegators(apiAtOriginal, apiAtPriorRewarded, originalRoundNumber)
  console.log(`collators count: ${Object.keys(stakedValue).length}`)
  

  console.log(stakedValue["0xc4df28afee88a6249c5bddd5dc6d20fea7c5d67d"]);



  // calculate reward amounts
  const parachainBondInfo = await apiAtPriorRewarded.query.parachainStaking.parachainBondInfo();
  const parachainBondPercent = new Percent(parachainBondInfo.percent);
  const totalStaked = await apiAtPriorRewarded.query.parachainStaking.staked(originalRoundNumber);
  const totalPoints = await apiAtPriorRewarded.query.parachainStaking.points(originalRoundNumber);
  const inflation = await apiAtPriorRewarded.query.parachainStaking.inflationConfig();
  const totalIssuance = await apiAtPriorRewarded.query.balances.totalIssuance();
  const collatorCommissionRate =
    await apiAtPriorRewarded.query.parachainStaking.collatorCommission();

  const range = {
    min: new Perbill(inflation.round.min).of(totalIssuance),
    ideal: new Perbill(inflation.round.ideal).of(totalIssuance),
    max: new Perbill(inflation.round.max).of(totalIssuance),
  };

  const totalRoundIssuance = (function () {
    if (totalStaked.lt(inflation.expect.min)) {
      return range.min;
    } else if (totalStaked.gt(inflation.expect.max)) {
      return range.max;
    } else {
      return range.ideal;
    }
  })();
  const totalCollatorCommissionReward = new Perbill(collatorCommissionRate).of(totalRoundIssuance);
  const totalBondReward = totalRoundIssuance.sub(totalCollatorCommissionReward);

  // calculate total staking reward
  const firstBlockRewardedEvents = await apiAtRewarded.query.system.events();
  let reservedForParachainBond = new BN(0);
  for (const { phase, event } of firstBlockRewardedEvents) {
    if (!phase.isInitialization) {
      continue;
    }
    // only deduct parachainBondReward if it was transferred (event must exist)
    if (apiAtRewarded.events.parachainStaking.ReservedForParachainBond.is(event)) {
      reservedForParachainBond = event.data[1] as any;
      break;
    }
  }

  // total expected staking reward minus the amount reserved for parachain bond
  const totalStakingReward = (function () {
    const parachainBondReward = parachainBondPercent.of(totalRoundIssuance);
    if (!reservedForParachainBond.isZero()) {
      /*
      expect(
        parachainBondReward.eq(reservedForParachainBond),
        `parachain bond amount does not match \
          ${parachainBondReward.toString()} != ${reservedForParachainBond.toString()} \
          for round ${originalRoundNumber.toString()}`
      ).to.be.true;
      */
      return totalRoundIssuance.sub(parachainBondReward);
    }

    return totalRoundIssuance;
  })();

  const delayedPayout = (
    await apiAtRewarded.query.parachainStaking.delayedPayouts(originalRoundNumber)
  ).unwrap();


  /*
  expect(
    delayedPayout.totalStakingReward.eq(totalStakingReward),
    `reward amounts do not match \
      ${delayedPayout.totalStakingReward.toString()} != ${totalStakingReward.toString()} \
      for round ${originalRoundNumber.toString()}`
  ).to.be.true;
  */

  // get the collators to be awarded via `awardedPts` storage
  const awardedCollators = (
    await apiAtPriorRewarded.query.parachainStaking.awardedPts.keys(originalRoundNumber)
  ).map((awarded) => awarded.args[1].toHex());
  const awardedCollatorCount = awardedCollators.length;

  // compute max rounds respecting the current block number and the number of awarded collators
  const maxRoundChecks = Math.min(latestBlockNumber - nowBlockNumber + 1, awardedCollatorCount);
  debug(`verifying ${maxRoundChecks} blocks for rewards (awarded ${awardedCollatorCount})`);
  const expectedRewardedCollators = new Set(awardedCollators);
  const rewardedCollators = new Set<HexString>();
  let totalRewardedAmount = new BN(0);

  // accumulate collator share percentages
  let totalCollatorShare = new BN(0);
  // accumulate amount lost while distributing rewards to delegators per collator
  let totalBondRewardedLoss = new BN(0);
  // accumulate total rewards given to collators & delegators due to bonding
  let totalBondRewarded = new BN(0);
  // accumulate total commission rewards per collator
  let totalCollatorCommissionRewarded = new BN(0);

  console.log("collators", collators);
  

  console.log("totalCollatorCommissionReward", totalCollatorCommissionReward);
  console.log("totalPoints", totalPoints);
  console.log("totalStakingReward", totalStakingReward)
  //console.log("stakedValue", stakedValue);

  console.log("delegators", delegators.size);
/*

  return {
    round: {
      totalStaked,
      totalPoints,
      totalStakingReward,
      totalBondReward,
      totalCollatorCommissionReward,
    },
    collators: [

    ]
  }
  */
  
  // iterate over the next blocks to verify rewards
  for await (const i of new Array(maxRoundChecks).keys()) {
    const blockNumber = nowRoundFirstBlock.addn(i);
    const rewarded = await getRewardedFromEventsAtBlock(
      api,
      specVersion,
      blockNumber,
      delegators,
      collators,
      totalCollatorCommissionReward,
      totalPoints,
      totalStakingReward,
      stakedValue
    );
    //console.log("rewarded", rewarded);

    totalCollatorShare = totalCollatorShare.add(rewarded.amount.collatorSharePerbill);
    totalCollatorCommissionRewarded = totalCollatorCommissionRewarded.add(
      rewarded.amount.commissionReward
    );
    totalRewardedAmount = totalRewardedAmount.add(rewarded.amount.total);
    //totalRewardedPoints = totalRewardedPoints.add(rewarded.amount.total);
    totalBondRewarded = totalBondRewarded.add(rewarded.amount.bondReward);
    totalBondRewardedLoss = totalBondRewardedLoss.add(rewarded.amount.bondRewardLoss);

    stakedValue[rewarded.collator].reward = rewarded.amount;
    stakedValue[rewarded.collator].payoutBlockId = rewarded.payoutBlockId;
    stakedValue[rewarded.collator].payoutBlockTime = rewarded.payoutBlockTime;

    for (let delegator of rewarded.delegators) {
      if ( stakedValue[rewarded.collator].delegators[delegator.id] ) {
        stakedValue[rewarded.collator].delegators[delegator.id].reward = delegator.reward;
      }
    }
  }
  //console.log(stakedValue["0xc4df28afee88a6249c5bddd5dc6d20fea7c5d67d"]);


  return {
    round: {
      id: originalRoundNumber,
      payoutBlockId: nowRoundFirstBlock.toNumber(),
      payoutBlockTime: nowRoundFirstBlockTime,
      startBlockId: originalRoundPriorBlock.toNumber(),
      startBlockTime: originalRoundPriorBlockTime,
      totalCollatorShare,
      totalCollatorCommissionRewarded,
      totalRewardedAmount,
      totalPoints,
      totalStaked,
      totalBondRewarded,
      totalBondRewardedLoss,
    },
    stakedValue
  }

}



async function getCollatorsAndDelegators(apiAtOriginal: ApiPromise, apiAtPriorRewarded: ApiPromise, roundNumber: number): Promise<{
  collators: Set<string>,
  delegators: Set<string>,
  stakedValue: StakedValue
}> {
  const atStake = await  apiAtPriorRewarded.query.parachainStaking.atStake.entries(
    roundNumber
  );
  const stakedValue: StakedValue = {};
  const collatorCount = atStake.length;

  const collators: Set<string> = new Set();
  const delegators: Set<string> = new Set();

  for (const [
    {
      args: [_, accountId],
    },
    { bond, total, delegations },
  ] of atStake) {
    const collatorId = accountId.toHex();
    collators.add(collatorId);
    const points = await apiAtPriorRewarded.query.parachainStaking.awardedPts(
      roundNumber,
      accountId
    );

    const collatorInfo: StakedValueData = {
      id: collatorId,
      bond,
      total,
      points,
      delegators: {},
    };

    const topDelegations = new Set(
      (await apiAtOriginal.query.parachainStaking.topDelegations(accountId))
        .unwrap()
        .delegations.map((d) => d.owner.toHex())
    );
    let countedDelegationSum = new BN(0);
    for (const { owner, amount } of delegations) {
      if (!topDelegations.has(owner.toHex())) {
        continue;
      }
      const id = owner.toHex();
      delegators.add(id);
      collatorInfo.delegators[id] = {
        id: id,
        amount: amount,
        reward: new BN(0)
      };
      countedDelegationSum = countedDelegationSum.add(amount);
    }
    const totalCountedLessTotalCounted = total.sub(countedDelegationSum.add(bond));
    // expect(total.toString()).to.equal(
    //   countedDelegationSum.add(bond).toString(),
    //   `Total counted (denominator) ${total} - total counted (numerator
    // ${countedDelegationSum.add(new BN(bond))} = ${totalCountedLessTotalCounted}` +
    //     ` so this collator and its delegations receive fewer rewards for round ` +
    //     `${originalRoundNumber.toString()}`
    // );

    for (const topDelegation of topDelegations) {
      if (!Object.keys(collatorInfo.delegators).includes(topDelegation)) {
        throw new Error(
          `${topDelegation} is missing from collatorInfo ` +
            `for round ${originalRoundNumber.toString()}`
        );
      }
    }
    for (const delegator of Object.keys(collatorInfo.delegators)) {
      if (!topDelegations.has(delegator as any)) {
        throw new Error(
          `${delegator} is missing from topDelegations for round ${originalRoundNumber.toString()}`
        );
      }
    }

    stakedValue[collatorId] = collatorInfo;
  }
  
  await fixDelegatorsStakeQueue (apiAtOriginal, stakedValue, delegators);

  return {
    collators,
    delegators,
    stakedValue
  }

}

async function fixDelegatorsStakeQueue (
  api: ApiPromise,
  stakedValue: StakedValue, 
  delegators: Set<string>
): Promise<void> {
  if (!delegators.size) return;

  return new Promise(async (res, rej) => {
    const processDelegators = async (delegatorId: string, cb: any): Promise<void> => {
      const zerodelegator2 = await api.query.parachainStaking.delegatorState(delegatorId);
      zerodelegator2.unwrap().delegations.map(delegation=>{
        const collatorId = delegation.owner.toHex();
        if (stakedValue[collatorId] && stakedValue[collatorId].delegators[delegatorId]) {
          stakedValue[collatorId].delegators[delegatorId].amount = delegation.amount;//.toString();
        }
      })
      cb()
    };

    const queue = new Queue(processDelegators, { concurrent: 50 })
    for (const delegatorId of Array.from(delegators)) {
      queue.push(delegatorId)
    }
    queue.on('drain', function () {
      res()
    })
    queue.on('task_failed', function (taskId: any, err: any, stats: any) {
      rej()
    })
  })
}


async function getRewardedFromEventsAtBlock(
  api: ApiPromise,
  specVersion: number,
  rewardedBlockNumber: BN,
  delegators: Set<string>,
  collators: Set<string>,
  totalCollatorCommissionReward: BN,
  totalPoints: u32,
  totalStakingReward: BN,
  stakedValue: StakedValue
): Promise<Rewarded> {
  const nowRoundRewardBlockHash = await api.rpc.chain.getBlockHash(rewardedBlockNumber);
  const apiAtBlock = await api.at(nowRoundRewardBlockHash);

  debug(`> block ${rewardedBlockNumber} (${nowRoundRewardBlockHash})`);

  const rewardedBlockTime = await apiAtBlock.query.timestamp.now();

  const rewards: { [key: HexString]: { account: string; amount: u128 } } = {};
  const blockEvents = await apiAtBlock.query.system.events();
  let rewardCount = 0;

  for (const { phase, event } of blockEvents) {
    if (!phase.isInitialization) {
      continue;
    }

    if (apiAtBlock.events.parachainStaking.Rewarded.is(event)) {
      rewardCount++;
      rewards[event.data[0].toHex()] = {
        account: event.data[0].toHex(),
        amount: event.data[1] as u128,
      };
    }
  }
  //expect(rewardCount).to.equal(Object.keys(rewards).length, "reward count mismatch");

  let bondReward: BN = new BN(0);
  let collatorInfo: any = {};
  let rewarded = {
    collator: null as HexString,
    delegators: new Array<DelegatorReward>(),
    payoutBlockId: rewardedBlockNumber,
    payoutBlockTime: rewardedBlockTime.toNumber(),
    amount: {
      total: new BN(0),
      commissionReward: new BN(0),
      bondReward: new BN(0),
      bondRewardLoss: new BN(0),
      collatorSharePerbill: new BN(0),
    },
  };
  let totalBondRewardShare = new BN(0);

  for (const accountId of Object.keys(rewards) as HexString[]) {
    rewarded.amount.total = rewarded.amount.total.add(rewards[accountId].amount);

    if (collators.has(accountId)) {
      // collator is always paid first so this is guaranteed to execute first
      collatorInfo = stakedValue[accountId];

      const pointsShare = new Perbill(collatorInfo.points, totalPoints);
      const collatorReward = pointsShare.of(totalStakingReward);
      rewarded.amount.collatorSharePerbill = pointsShare.value();
      const collatorCommissionReward = pointsShare.of(totalCollatorCommissionReward);
      rewarded.amount.commissionReward = collatorCommissionReward;
      bondReward = collatorReward.sub(collatorCommissionReward);

      if (!stakedValue[accountId].delegators) {
        assertEqualWithAccount(rewards[accountId].amount, collatorReward, `${accountId} (COL)`);
      } else {
        const bondShare = new Perbill(collatorInfo.bond, collatorInfo.total);
        totalBondRewardShare = totalBondRewardShare.add(bondShare.value());
        const collatorBondReward = bondShare.of(bondReward);
        rewarded.amount.bondReward = rewarded.amount.bondReward.add(collatorBondReward);
        const collatorTotalReward = collatorBondReward.add(collatorCommissionReward);
        assertEqualWithAccount(
          rewards[accountId].amount,
          collatorTotalReward,
          `${accountId} (COL)`
        );
      }
      rewarded.collator = accountId;
    } else if (delegators.has(accountId)) {
      /*
      expect(
        collatorInfo.delegators,
        "collator was not paid before the delegator (possibly not at all)"
      ).to.exist;
      */

      // skip checking if rewarded amount was zero
      if (rewards[accountId].amount.isZero()) {
        continue;
      }
      const bondShare = new Perbill(collatorInfo.delegators[accountId].amount, collatorInfo.total);
      totalBondRewardShare = totalBondRewardShare.add(bondShare.value());
      const delegatorReward = bondShare.of(bondReward);
      rewarded.amount.bondReward = rewarded.amount.bondReward.add(delegatorReward);
      rewarded.delegators.push({
        id: accountId,
        reward: delegatorReward
      });
      assertEqualWithAccount(rewards[accountId].amount, delegatorReward, `${accountId} (DEL)`);
    } else {
      throw Error(`invalid key ${accountId}, neither collator not delegator`);
    }
  }

  if (specVersion >= 1800) {
    // we calculate the share loss since adding all percentages will usually not yield a full 100%
    const estimatedBondRewardedLoss = new Perbill(BN_BILLION.sub(totalBondRewardShare)).of(
      bondReward
    );
    const actualBondRewardedLoss = bondReward.sub(rewarded.amount.bondReward);

    // Perbill arithmetic can deviate at most ±1 per operation so we use the number of delegators
    // and the collator itself to compute the max deviation per billion
    const maxDifference = rewarded.delegators.size + 1;
    const loss = estimatedBondRewardedLoss.sub(actualBondRewardedLoss).abs();
    /*
    expect(
      loss.lten(maxDifference),
      `Total bond rewarded share loss for collator "${rewarded.collator}" was above \
${maxDifference} parts per billion, got diff "${loss}", estimated loss \
${estimatedBondRewardedLoss}, actual loss ${actualBondRewardedLoss}`
    ).to.be.true;
    */

    rewarded.amount.bondRewardLoss = actualBondRewardedLoss;
  }

  return rewarded;
}


function assertEqualWithAccount(a: BN, b: BN, account: string) {
  const diff = a.sub(b);

  /*
  expect(
    diff.abs().isZero(),
    `${account} ${a.toString()} != ${b.toString()}, difference of ${diff.abs().toString()}`
  ).to.be.true;
  */
}



type DelegatorReward = {
  id: string;
  reward: BN;
}

type DelegatorInfo = {
  id: string; 
  amount: u128;
  reward: u128;
}

type CollatorReward = {
  // The percentage point share in Perbill of the collator
  collatorSharePerbill: BN;

  // Total rewarded
  total: BN;
  // Contribution of commission rewards towards the total
  commissionReward: BN;
  // Contribution of bond rewards towards the total
  bondReward: BN;
  // Portion of rewards lost due to Perbill arithmetic (sum of bond shares not 100%)
  bondRewardLoss: BN;
};

type Rewarded = {
  // Collator account id
  collator: HexString | null;
  // Set of delegator account ids
  delegators: Array<DelegatorReward>;
  // The rewarded amount
  amount: CollatorReward;
};

type StakedValueData = {
  id: string;
  bond: u128;
  total: u128;
  points: u32;
  delegators: { [key: string]: DelegatorInfo };
  payoutBlockId: u128;
  payoutBlockTime: u128;
  reward: CollatorReward
};

type StakedValue = {
  [key: string]: StakedValueData;
};


class Perthing {
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

  value(): BN {
    return this.perthing;
  }

  of(value: BN): BN {
    return this.divNearest(this.perthing.mul(value), this.unit);
  }

  toString(): string {
    return `${this.perthing.toString()}`;
  }

  divNearest(a: any, num: BN) {
    var dm = a.divmod(num);

    // Fast case - exact division
    if (dm.mod.isZero()) return dm.div;

    var mod = dm.div.negative !== 0 ? dm.mod.isub(num) : dm.mod;

    var half = num.ushrn(1);
    var r2 = num.andln(1) as any;
    var cmp = mod.cmp(half);

    // Round down
    if (cmp <= 0 || (r2 === 1 && cmp === 0)) return dm.div;

    // Round up
    return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
  }
}


class Perbill extends Perthing {
  constructor(numerator: BN, denominator?: BN) {
    super(new BN(1_000_000_000), numerator, denominator);
  }
}

class Percent extends Perthing {
  constructor(numerator: BN, denominator?: BN) {
    super(new BN(100), numerator, denominator);
  }
}

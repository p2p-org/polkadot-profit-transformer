import { ApiPromise } from '@polkadot/api'
import { BN, BN_BILLION } from '@polkadot/util'
import Queue from 'better-queue'
import type { HexString } from '@polkadot/util/types';
import type { u128, u32 } from '@polkadot/types-codec';
import {
  DelegatorReward,
  DelegatorInfo,
  CollatorReward,
  Rewarded,
  StakedValueData,
  StakedValue,
  Perthing,
  Perbill,
  Percent,
} from './interfaces';

export class ParachaingRewardsProcessor {
  api: ApiPromise;

  constructor(api: ApiPromise) {
    this.api = api;
  }

  async getReward(nowBlockNumber: number): Promise<{ round: any, stakedValue: StakedValue }> {
    console.log('---------------------------------')
    const latestBlock = await this.api.rpc.chain.getBlock();
    const latestBlockHash = latestBlock.block.hash;
    const latestBlockNumber = latestBlock.block.header.number.toNumber();
    const latestRound: any = await (await this.api.at(latestBlock.block.hash)).query.parachainStaking.round();
    const nowBlockHash = await this.api.rpc.chain.getBlockHash(nowBlockNumber);
    const nowRound: any = await (await this.api.at(nowBlockHash)).query.parachainStaking.round();
    const nowRoundNumber = nowRound.current;
    const nowRoundFirstBlock = nowRound.first;
    const nowRoundFirstBlockTime = await (await this.api.at(nowBlockHash)).query.timestamp.now();
    const nowRoundFirstBlockHash = await this.api.rpc.chain.getBlockHash(nowRoundFirstBlock);
    const apiAtRewarded = await this.api.at(nowRoundFirstBlockHash);
    const rewardDelay = apiAtRewarded.consts.parachainStaking.rewardPaymentDelay;
    const priorRewardedBlockHash = await this.api.rpc.chain.getBlockHash(nowRoundFirstBlock.subn(1));
    const specVersion = (await apiAtRewarded.query.system.lastRuntimeUpgrade()).unwrap().specVersion.toNumber();

    // obtain data from original round
    const rewardRound: any = await apiAtRewarded.query.parachainStaking.round();
    const originalRoundNumber = rewardRound.current.sub(
      rewardDelay,
    );
    let iterOriginalRoundBlock = nowRoundFirstBlock.toBn();
    while (true) {
      const blockHash = await this.api.rpc.chain.getBlockHash(iterOriginalRoundBlock);
      const round: any = await (await this.api.at(blockHash)).query.parachainStaking.round();
      if (
        round.current.eq(originalRoundNumber)
        || iterOriginalRoundBlock.sub(round.length).toNumber() < 0
      ) {
        break;
      }

      // go previous round
      iterOriginalRoundBlock = iterOriginalRoundBlock.sub(round.length);
    }
    // we go to the last block of the (original round - 1) since data is snapshotted at round start.
    const originalRoundPriorBlock = iterOriginalRoundBlock.subn(1);
    const originalRoundPriorBlockHash = await this.api.rpc.chain.getBlockHash(originalRoundPriorBlock);
    const apiAtOriginal: any = await this.api.at(originalRoundPriorBlockHash);
    const originalRoundPriorBlockTime = await apiAtOriginal.query.timestamp.now();
    const apiAtPriorRewarded = await this.api.at(priorRewardedBlockHash);

    console.debug(`
      latest  ${latestRound.current.toString()} (${latestBlockNumber} / ${latestBlockHash.toHex()})
      now     ${nowRound.current.toString()} (${nowBlockNumber} / ${nowBlockHash.toHex()})
      round   ${originalRoundNumber.toString()} (prior round last block \
      ${originalRoundPriorBlock} / ${originalRoundPriorBlockHash.toHex()})
      paid in ${nowRoundNumber.toString()} (first block \
      ${nowRoundFirstBlock.toNumber()} / ${nowRoundFirstBlockHash.toHex()} / prior \
      ${priorRewardedBlockHash.toHex()})
    `);

    // collect info about staked value from collators and delegators

    const { collators, delegators, stakedValue } = await this.getCollatorsAndDelegators(apiAtOriginal, apiAtPriorRewarded, originalRoundNumber)
    console.log(`collators count: ${Object.keys(stakedValue).length}`)

    // calculate reward amounts
    const parachainBondInfo: any = await apiAtPriorRewarded.query.parachainStaking.parachainBondInfo();
    const parachainBondPercent = new Percent(parachainBondInfo.percent);
    const totalStaked: any = await apiAtPriorRewarded.query.parachainStaking.staked(originalRoundNumber);
    const totalPoints = await apiAtPriorRewarded.query.parachainStaking.points(originalRoundNumber);
    const inflation: any = await apiAtPriorRewarded.query.parachainStaking.inflationConfig();
    const totalIssuance = await apiAtPriorRewarded.query.balances.totalIssuance();
    const collatorCommissionRate: any = await apiAtPriorRewarded.query.parachainStaking.collatorCommission();

    const range = {
      min: new Perbill(inflation.round.min).of(totalIssuance),
      ideal: new Perbill(inflation.round.ideal).of(totalIssuance),
      max: new Perbill(inflation.round.max).of(totalIssuance),
    };

    const totalRoundIssuance = (function () {
      if (totalStaked.lt(inflation.expect.min)) {
        return range.min;
      } if (totalStaked.gt(inflation.expect.max)) {
        return range.max;
      }
      return range.ideal;

    }())
    const totalCollatorCommissionReward = new Perbill(collatorCommissionRate).of(totalRoundIssuance);
    const totalBondReward = totalRoundIssuance.sub(totalCollatorCommissionReward);

    // calculate total staking reward
    const firstBlockRewardedEvents: any = await apiAtRewarded.query.system.events();
    let reservedForParachainBond = new BN(0);
    for (const { phase, event } of firstBlockRewardedEvents) {
      if (!phase.isInitialization) {
        continue;
      }
      // only deduct parachainBondReward if it was transferred (event must exist)
      if (apiAtRewarded.events.parachainStaking.ReservedForParachainBond.is(event)) {
        reservedForParachainBond = event.data[1] as any;
        break
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
    }())

    /*
    const delayedPayout = (
      await apiAtRewarded.query.parachainStaking.delayedPayouts(originalRoundNumber)
    ).unwrap();
  */

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
    console.debug(`verifying ${maxRoundChecks} blocks for rewards (awarded ${awardedCollatorCount})`);
    const expectedRewardedCollators = new Set(awardedCollators);
    const rewardedCollators = new Set<HexString>();
    let totalRewardedAmount = new BN(0);

    // accumulate collator share percentages
    let totalCollatorShare = new BN(0);
    // accumulate amount lost while distributing rewards to delegators per collator
    const totalBondRewardedLoss = new BN(0);
    // accumulate total rewards given to collators & delegators due to bonding
    let totalBondRewarded = new BN(0);
    // accumulate total commission rewards per collator
    let totalCollatorCommissionRewarded = new BN(0);

    console.log('collators', collators);

    console.log('totalCollatorCommissionReward', totalCollatorCommissionReward);
    console.log('totalPoints', totalPoints);
    console.log('totalStakingReward', totalStakingReward)
    // console.log("stakedValue", stakedValue);

    console.log('delegators', delegators.size);
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
      const rewarded: any = await this.getRewardedFromEventsAtBlock(
        specVersion,
        blockNumber,
        delegators,
        collators,
        totalCollatorCommissionReward,
        totalPoints,
        totalStakingReward,
        stakedValue,
      );
      if (!rewarded.collator) {
        console.log('PRB2!!!')
        continue
      }

      // console.log("rewarded", rewarded);

      totalCollatorShare = totalCollatorShare.add(rewarded.amount.collatorSharePerbill);
      totalCollatorCommissionRewarded = totalCollatorCommissionRewarded.add(
        rewarded.amount.commissionReward,
      );
      totalRewardedAmount = totalRewardedAmount.add(rewarded.amount.total);
      // totalRewardedPoints = totalRewardedPoints.add(rewarded.amount.total);
      totalBondRewarded = totalBondRewarded.add(rewarded.amount.bondReward);
      // totalBondRewardedLoss = totalBondRewardedLoss.add(rewarded.amount.bondRewardLoss);

      stakedValue[rewarded.collator].reward = rewarded.amount;
      stakedValue[rewarded.collator].payoutBlockId = rewarded.payoutBlockId;
      stakedValue[rewarded.collator].payoutBlockTime = rewarded.payoutBlockTime;

      for (const delegator of rewarded.delegators) {
        if (stakedValue[rewarded.collator].delegators[delegator.id]) {
          stakedValue[rewarded.collator].delegators[delegator.id].reward = delegator.reward;
        }
      }
    }
    // console.log(stakedValue["0xc4df28afee88a6249c5bddd5dc6d20fea7c5d67d"]);

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
        // totalBondRewardedLoss,
      },
      stakedValue,
    }
  }

  async getCollatorsAndDelegators(apiAtOriginal: ApiPromise, apiAtPriorRewarded: any, roundNumber: number): Promise<{
    collators: Set<string>,
    delegators: Set<string>,
    stakedValue: StakedValue
  }> {
    const atStake = await apiAtPriorRewarded.query.parachainStaking.atStake.entries(
      roundNumber,
    );
    const stakedValue: StakedValue = {};
    // const collatorCount = atStake.length;

    const collators: Set<string> = new Set();
    const delegators: Set<string> = new Set();

    for (const [{ args: [_, accountId] }, { bond, total, delegations }] of atStake) {
      const collatorId = accountId.toHex();
      collators.add(collatorId);
      const points = await apiAtPriorRewarded.query.parachainStaking.awardedPts(
        roundNumber,
        accountId,
      );

      const collatorInfo: StakedValueData = {
        id: collatorId,
        bond,
        total,
        points,
        delegators: {},
      };

      const topDelegationsSet = new Set();
      if (apiAtOriginal.query.parachainStaking.topDelegations) {
        const _topDelegations: any = (await apiAtOriginal.query.parachainStaking.topDelegations(accountId));
        const topDelegations = _topDelegations
          .unwrap()
          .delegations

        if (topDelegations) {
          for (const d of topDelegations) {
            topDelegationsSet.add(d.owner.toHex());
          }
        }
      }
      // let countedDelegationSum = new BN(0);
      for (const { owner, amount } of delegations) {
        // if (apiAtOriginal.query.parachainStaking.topDelegations && !topDelegationsSet.has(owner.toHex())) {
        //  continue;
        // }
        const id = owner.toHex();
        delegators.add(id);
        collatorInfo.delegators[id] = {
          id,
          final_amount: amount,
          amount,
          reward: new BN(0),
        };
        // countedDelegationSum = countedDelegationSum.add(amount);
      }
      // const totalCountedLessTotalCounted = total.sub(countedDelegationSum.add(bond));
      // expect(total.toString()).to.equal(
      //   countedDelegationSum.add(bond).toString(),
      //   `Total counted (denominator) ${total} - total counted (numerator
      // ${countedDelegationSum.add(new BN(bond))} = ${totalCountedLessTotalCounted}` +
      //     ` so this collator and its delegations receive fewer rewards for round ` +
      //     `${originalRoundNumber.toString()}`
      // );

      /*
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
      */

      stakedValue[collatorId] = collatorInfo;
    }

    await this.fixDelegatorsStakeQueue(apiAtOriginal, stakedValue, delegators);

    return {
      collators,
      delegators,
      stakedValue,
    }

  }

  async fixDelegatorsStakeQueue(
    api: ApiPromise,
    stakedValue: StakedValue,
    delegators: Set<string>,
  ): Promise<void> {
    if (!delegators.size) return;

    return new Promise(async (res, rej) => {
      const processDelegators = async (delegatorId: string, cb: any): Promise<void> => {
        const zerodelegator2: any = await this.api.query.parachainStaking.delegatorState(delegatorId);
        zerodelegator2.unwrap().delegations.map((delegation: any) => {
          const collatorId = delegation.owner.toHex();
          if (stakedValue[collatorId] && stakedValue[collatorId].delegators[delegatorId]) {
            stakedValue[collatorId].delegators[delegatorId].amount = delegation.amount;// .toString();
          }
        })
        cb()
      }

      const queue = new Queue(processDelegators, { concurrent: 50 })
      for (const delegatorId of Array.from(delegators)) {
        queue.push(delegatorId)
      }
      queue.on('drain', () => {
        res()
      });
      queue.on('task_failed', (taskId: any, err: any, stats: any) => {
        rej()
      });
    })
  }

  async getRewardedFromEventsAtBlock(
    specVersion: number,
    rewardedBlockNumber: BN,
    delegators: Set<string>,
    collators: Set<string>,
    totalCollatorCommissionReward: BN,
    totalPoints: any,
    totalStakingReward: BN,
    stakedValue: StakedValue,
  ): Promise<Rewarded> {
    const nowRoundRewardBlockHash = await this.api.rpc.chain.getBlockHash(rewardedBlockNumber);
    const apiAtBlock = await this.api.at(nowRoundRewardBlockHash);

    console.debug(`> block ${rewardedBlockNumber} (${nowRoundRewardBlockHash})`);

    const rewardedBlockTime: any = await apiAtBlock.query.timestamp.now();

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
    // expect(rewardCount).to.equal(Object.keys(rewards).length, "reward count mismatch");

    let bondReward: BN = new BN(0);
    let collatorInfo: any = {};
    const rewarded: any = {
      collator: null,
      delegators: new Array<DelegatorReward>(),
      payoutBlockId: rewardedBlockNumber,
      payoutBlockTime: rewardedBlockTime.toNumber(),
      amount: {
        total: new BN(0),
        commissionReward: new BN(0),
        bondReward: new BN(0),
        // bondRewardLoss: new BN(0),
        collatorSharePerbill: new BN(0),
      },
    };
    let totalBondRewardShare = new BN(0);

    console.log('------------', specVersion);
    for (const accountId of Object.keys(rewards) as HexString[]) {
      rewarded.amount.total = rewarded.amount.total.add(rewards[accountId].amount);

      if (collators.has(accountId)) {
        console.log('COLLATOR')
        // collator is always paid first so this is guaranteed to execute first
        collatorInfo = stakedValue[accountId];

        const pointsShare = new Perbill(collatorInfo.points, totalPoints);
        const collatorReward = pointsShare.of(totalStakingReward);
        rewarded.amount.collatorSharePerbill = pointsShare.value();
        const collatorCommissionReward = pointsShare.of(totalCollatorCommissionReward);
        rewarded.amount.commissionReward = collatorCommissionReward;
        bondReward = collatorReward.sub(collatorCommissionReward);

        if (!stakedValue[accountId].delegators) {
          this.assertEqualWithAccount(rewards[accountId].amount, collatorReward, `${accountId} (COL)`);
        } else {
          const bondShare = new Perbill(collatorInfo.bond, collatorInfo.total);
          totalBondRewardShare = totalBondRewardShare.add(bondShare.value());
          const collatorBondReward = bondShare.of(bondReward);
          rewarded.amount.bondReward = rewarded.amount.bondReward.add(collatorBondReward);
          const collatorTotalReward = collatorBondReward.add(collatorCommissionReward);
          this.assertEqualWithAccount(
            rewards[accountId].amount,
            collatorTotalReward,
            `${accountId} (COL)`,
          );
        }
        rewarded.collator = accountId;
      } else if (delegators.has(accountId)) {
        /*

        if (specVersion === 1002 && !collatorInfo.delegators[accountId]) {
          console.log("PRB!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!");
          continue;
        }
        */
        console.log('DELEGA')
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
        console.log('account', accountId);
        console.log('amount', collatorInfo.delegators[accountId].amount);
        const bondShare = new Perbill(collatorInfo.delegators[accountId].amount, collatorInfo.total);
        totalBondRewardShare = totalBondRewardShare.add(bondShare.value());
        const delegatorReward = bondShare.of(bondReward);
        rewarded.amount.bondReward = rewarded.amount.bondReward.add(delegatorReward);
        rewarded.delegators.push({
          id: accountId,
          reward: delegatorReward,
        });
        this.assertEqualWithAccount(rewards[accountId].amount, delegatorReward, `${accountId} (DEL)`);
      } else {
        //      if (!(
        //        (accountId === '0x6ac4b6725efd8a1cb397884769730094e854efd4' && rewardedBlockNumber.toNumber() === 640219) ||
        //        (accountId === '0x5d9bc481749420cffb2bf5aef5c5e2a0ffe04e88' && rewardedBlockNumber.toNumber() === 1061443)
        //      )) {
        throw Error(`invalid key ${accountId}, neither collator not delegator`);
        // }
      }
    }

    if (specVersion >= 1800) {
      // we calculate the share loss since adding all percentages will usually not yield a full 100%
      const estimatedBondRewardedLoss = new Perbill(BN_BILLION.sub(totalBondRewardShare)).of(
        bondReward,
      );
      const actualBondRewardedLoss = bondReward.sub(rewarded.amount.bondReward);

      // Perbill arithmetic can deviate at most ±1 per operation so we use the number of delegators
      // and the collator itself to compute the max deviation per billion
      const maxDifference = rewarded.delegators.length + 1;
      const loss = estimatedBondRewardedLoss.sub(actualBondRewardedLoss).abs();

      rewarded.amount.bondRewardLoss = actualBondRewardedLoss;
    }

    console.log('returned')
    console.log('!!!!!!!!!!!!!', rewarded.amount.bondRewardLoss)

    return rewarded;
  }

  assertEqualWithAccount(a: BN, b: BN, account: string) {
    const diff = a.sub(b);
    if (diff.abs().isZero()) {
      throw Error(`${account} ${a.toString()} != ${b.toString()}, difference of ${diff.abs().toString()}`);
    }
  }
}

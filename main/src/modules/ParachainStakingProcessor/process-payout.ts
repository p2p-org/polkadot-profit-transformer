/* eslint-disable import/no-extraneous-dependencies */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
/* eslint no-console: ["error", { allow: ["warn", "error"] }] */
/* eslint no-constant-condition: ["error", { "checkLoops": false }] */

import { Knex } from 'knex';
import Queue from 'better-queue';
import { ApiPromise } from '@polkadot/api';
import { BN } from '@polkadot/util';
import type { HexString } from '@polkadot/util/types';
import type { u128 } from '@polkadot/types-codec';
import { Moment, SignedBlock, BlockHash } from '@polkadot/types/interfaces';
import { logger } from '@/loaders/logger';
import { StakingRepository } from '@/apps/common/infra/postgresql/staking.repository';
import {
  DelegatorReward,
  Rewarded,
  StakedValueData,
  StakedValue,
  RoundValue,
  Perbill,
  Percent,
} from './interfaces';

export default class RoundPayoutProcessor {
  api: ApiPromise;

  isDebug = true;

  constructor(api: ApiPromise) {
    this.api = api;
  }

  async processRoundPayout(
    metadata: any,
    roundId: number,
    payoutBlockId: number,
    trx: Knex.Transaction,
    stakingRepository: StakingRepository,
  ): Promise<void> {
    const start = Date.now();
    logger.info({
      event: 'RoundPayoutProcessor.processRoundPayout', message: `Process staking payout for round: ${roundId}`, metadata, roundId,
    });

    try {
      const { round, stakedValue } = await this.getRewards(payoutBlockId);

      logger.info({
        event: 'RoundPayoutProcessor.processRoundPayout',
        message: 'Round processed',
        round_id: parseInt(round.id.toString(10), 10),
        payout_block_id: round.payoutBlockId,
        payout_block_time: new Date(parseInt(round.payoutBlockTime.toString(10), 10)),
        start_block_id: round.startBlockId,
        start_block_time: new Date(parseInt(round.startBlockTime.toString(10), 10)),
        total_reward: round.totalRewardedAmount.toString(10),
        total_stake: round.totalStaked.toString(),
        total_reward_points: parseInt(round.totalPoints.toString(), 10),
        collators_count: Object.keys(stakedValue).length,
        runtime: round.specVersion,
      });

      await stakingRepository(trx).round.save({
        round_id: parseInt(round.id.toString(10), 10),
        payout_block_id: round.payoutBlockId,
        payout_block_time: new Date(parseInt(round.payoutBlockTime.toString(10), 10)),
        start_block_id: round.startBlockId,
        start_block_time: new Date(parseInt(round.startBlockTime.toString(10), 10)),
        total_reward: round.totalRewardedAmount.toString(10),
        total_stake: round.totalStaked.toString(),
        total_reward_points: parseInt(round.totalPoints.toString(), 10),
        collators_count: Object.keys(stakedValue).length,
        runtime: round.specVersion,
      });

      for (const collator of Object.values(stakedValue) as any) {
        await stakingRepository(trx).collators.save({
          round_id: parseInt(round.id.toString(10), 10),
          account_id: collator.id,
          total_stake: collator.total.toString(10),
          own_stake: collator.bond.toString(10),
          delegators_count: Object.keys(collator.delegators).length,
          total_reward_points: parseInt(collator.points.toString(10), 10),
          total_reward: collator.reward && collator.reward.total ? collator.reward.total.toString(10) : '0',
          collator_reward: collator.reward && collator.reward.collator ? collator.reward.collator.toString(10) : '0',
          payout_block_id: collator.payoutBlockId ? parseInt(collator.payoutBlockId, 10) : undefined,
          payout_block_time: collator.payoutBlockTime ? new Date(collator.payoutBlockTime) : undefined,
        });

        for (const delegator of Object.values(collator.delegators) as any) {
          await stakingRepository(trx).delegators.save({
            round_id: parseInt(round.id.toString(10), 10),
            account_id: delegator.id,
            collator_id: collator.id,
            amount: delegator.amount.toString(10),
            final_amount: delegator.final_amount.toString(10),
            reward: delegator.reward.toString(10),
            payout_block_id: collator.payoutBlockId ? parseInt(collator.payoutBlockId, 10) : undefined,
            payout_block_time: collator.payoutBlockTime ? new Date(collator.payoutBlockTime) : undefined,
          });
        }
      }

      const finish = Date.now();

      logger.info({
        event: `Round ${roundId.toString()} staking processing finished in ${(finish - start) / 1000} seconds.`,
        metadata,
        roundId,
      });
    } catch (error: any) {
      console.error(error);
      logger.warn({
        event: 'RoundPayoutProcessor.processRoundPayout',
        error: `error in processing round staking: ${error.message}`,
      });
      throw error;
    }
  }

  async getRewards(
    nowBlockNumber: number,
  ): Promise<{ round: RoundValue, stakedValue: StakedValue }> {
    const latestBlock: SignedBlock = await this.api.rpc.chain.getBlock() as SignedBlock;
    // const latestBlockHash: HexString = latestBlock.block.hash;
    const latestBlockNumber = latestBlock.block.header.number.toNumber();
    // const latestRound: any = await (await this.api.at(latestBlockHash)).query.parachainStaking.round();
    const nowBlockHash: BlockHash = await this.api.rpc.chain.getBlockHash(nowBlockNumber);
    const apiAtNowBlock = await this.api.at(nowBlockHash);
    const nowRound: any = await apiAtNowBlock.query.parachainStaking.round();
    const nowRoundNumber = nowRound.current;
    const nowRoundFirstBlock = nowRound.first;
    const nowRoundFirstBlockTime: Moment = await apiAtNowBlock.query.timestamp.now() as Moment;
    const nowRoundFirstBlockHash: BlockHash = await this.api.rpc.chain.getBlockHash(nowRoundFirstBlock);
    const apiAtRewarded = await this.api.at(nowRoundFirstBlockHash);
    const rewardDelay = apiAtRewarded.consts.parachainStaking.rewardPaymentDelay;
    const priorRewardedBlockHash: BlockHash = await this.api.rpc.chain.getBlockHash(nowRoundFirstBlock.subn(1));
    const runtime: any = await apiAtRewarded.query.system.lastRuntimeUpgrade();
    const specVersion = runtime.unwrap().specVersion.toNumber();

    // obtain data from original round
    const rewardRound: any = await apiAtRewarded.query.parachainStaking.round();
    const originalRoundNumber = rewardRound.current.sub(
      rewardDelay,
    );
    let originalRoundBlock = nowRoundFirstBlock.toBn();
    while (true) {
      const blockHash: BlockHash = await this.api.rpc.chain.getBlockHash(originalRoundBlock);
      const round: any = await (await this.api.at(blockHash)).query.parachainStaking.round();
      if (
        round.current.eq(originalRoundNumber)
        || originalRoundBlock.sub(round.length).toNumber() < 0
      ) {
        break;
      }
      // go previous round
      originalRoundBlock = originalRoundBlock.sub(round.length);
    }
    const originalRoundBlockHash: BlockHash = await this.api.rpc.chain.getBlockHash(originalRoundBlock);
    const apiAtOriginal: any = await this.api.at(originalRoundBlockHash);
    const originalRoundBlockTime: Moment = await apiAtOriginal.query.timestamp.now();

    // we go to the last block of the (original round - 1) since data is snapshotted at round start.
    const originalRoundPriorBlock = originalRoundBlock.subn(1);
    const originalRoundPriorBlockHash: BlockHash = await this.api.rpc.chain.getBlockHash(originalRoundPriorBlock);
    const apiAtOriginalPrior: any = await this.api.at(originalRoundPriorBlockHash);
    const apiAtPriorRewarded = await this.api.at(priorRewardedBlockHash);

    logger.info({
      event: 'RoundPayoutProcessor.getRewards',
      message: 'Rounds info',
      originalRoundNumber: originalRoundNumber.toString(),
      originalRoundPriorBlock: originalRoundPriorBlock.toNumber(),
      paidRoundNumber: nowRoundNumber.toString(),
      nowRoundFirstBlock: nowRoundFirstBlock.toNumber(),
    });

    // collect info about staked value from collators and delegators
    const { collators, delegators, stakedValue } = await this
      .getCollatorsAndDelegators(apiAtOriginalPrior, apiAtPriorRewarded, originalRoundNumber);

    logger.info({
      event: 'RoundPayoutProcessor.getRewards',
      message: `Collators count: ${Object.keys(stakedValue).length}`,
    });

    // calculate reward amounts
    const parachainBondInfo: any = await apiAtPriorRewarded.query.parachainStaking.parachainBondInfo();
    const parachainBondPercent = new Percent(parachainBondInfo.percent);
    const totalStaked: any = await apiAtPriorRewarded.query.parachainStaking.staked(originalRoundNumber);
    const totalPoints: any = await apiAtPriorRewarded.query.parachainStaking.points(originalRoundNumber);
    const inflation: any = await apiAtPriorRewarded.query.parachainStaking.inflationConfig();
    const totalIssuance: BN = await apiAtPriorRewarded.query.balances.totalIssuance() as BN;
    const collatorCommissionRate: any = await apiAtPriorRewarded.query.parachainStaking.collatorCommission();

    const range = {
      min: new Perbill(inflation.round.min).of(totalIssuance),
      ideal: new Perbill(inflation.round.ideal).of(totalIssuance),
      max: new Perbill(inflation.round.max).of(totalIssuance),
    };

    const totalRoundIssuance = (() => {
      if (totalStaked.lt(inflation.expect.min)) {
        return range.min;
      } if (totalStaked.gt(inflation.expect.max)) {
        return range.max;
      }
      return range.ideal;
    })();
    const totalCollatorCommissionReward = new Perbill(collatorCommissionRate).of(totalRoundIssuance);

    // calculate total staking reward
    const firstBlockRewardedEvents: any = await apiAtRewarded.query.system.events();
    let reservedForParachainBond = new BN(0);
    for (const { phase, event } of firstBlockRewardedEvents) {
      if (phase.isInitialization) {
        // only deduct parachainBondReward if it was transferred (event must exist)
        if (apiAtRewarded.events.parachainStaking.ReservedForParachainBond.is(event)) {
          reservedForParachainBond = event.data[1] as any;
          break;
        }
      }
    }

    // total expected staking reward minus the amount reserved for parachain bond
    const totalStakingReward = (() => {
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
    logger.info({
      event: 'RoundPayoutProcessor.getRewards',
      message: `verifying ${maxRoundChecks} blocks for rewards (awarded ${awardedCollatorCount})`,
    });
    let totalRewardedAmount = new BN(0);

    // accumulate collator share percentages
    let totalCollatorShare = new BN(0);
    // accumulate total rewards given to collators & delegators due to bonding
    let totalBondRewarded = new BN(0);
    // accumulate total commission rewards per collator
    let totalCollatorCommissionRewarded = new BN(0);

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
      if (rewarded.collator) {
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
    }

    return {
      round: {
        id: originalRoundNumber,
        payoutBlockId: nowRoundFirstBlock.toNumber(),
        payoutBlockTime: nowRoundFirstBlockTime,
        startBlockId: originalRoundBlock.toNumber(),
        startBlockTime: originalRoundBlockTime,
        totalCollatorShare,
        totalCollatorCommissionRewarded,
        totalRewardedAmount,
        totalPoints,
        totalStaked,
        totalBondRewarded,
        specVersion,
        // totalBondRewardedLoss,
      },
      stakedValue,
    };
  }

  async getCollatorsAndDelegators(apiAtOriginalPrior: ApiPromise, apiAtPriorRewarded: any, roundNumber: number): Promise<{
    collators: Set<string>,
    delegators: Set<string>,
    stakedValue: StakedValue
  }> {
    const atStake = await apiAtPriorRewarded.query.parachainStaking.atStake.entries(
      roundNumber,
    );
    const stakedValue: StakedValue = {};
    const collators: Set<string> = new Set();
    const delegators: Set<string> = new Set();

    for (const [{ args: [, accountId] }, { bond, total, delegations }] of atStake) {
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
      if (apiAtOriginalPrior.query.parachainStaking.topDelegations) {
        const accountDelegations: any = (await apiAtOriginalPrior.query.parachainStaking.topDelegations(accountId));
        const topDelegations = accountDelegations
          .unwrap()
          .delegations;

        if (topDelegations) {
          for (const d of topDelegations) {
            topDelegationsSet.add(d.owner.toHex());
          }
        }
      }
      for (const { owner, amount } of delegations) {
        if (apiAtOriginalPrior.query.parachainStaking.topDelegations && !topDelegationsSet.has(owner.toHex())) {
          // eslint-disable-next-line no-continue
          continue;
        }
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

      // for (const topDelegation of topDelegations) {
      //  if (!Object.keys(collatorInfo.delegators).includes(topDelegation)) {
      //    throw new Error(
      //      `${topDelegation} is missing from collatorInfo ` +
      //        `for round ${originalRoundNumber.toString()}`
      //    );
      //  }
      // }

      // for (const delegator of Object.keys(collatorInfo.delegators)) {
      //  if (!topDelegations.has(delegator as any)) {
      //    throw new Error(
      //      `${delegator} is missing from topDelegations for round ${originalRoundNumber.toString()}`
      //    );
      //  }
      // }

      stakedValue[collatorId] = collatorInfo;
    }

    const zeroStakedValue = await this.fixZeroDelegatorsStakeQueue(apiAtOriginalPrior, stakedValue, delegators);

    return {
      collators,
      delegators,
      stakedValue: zeroStakedValue,
    };
  }

  async fixZeroDelegatorsStakeQueue(
    apiAtOriginalPrior: ApiPromise,
    stakedValue: StakedValue,
    delegators: Set<string>,
  ): Promise<StakedValue> {
    const newStakedValue = stakedValue;

    if (!delegators.size) {
      return newStakedValue;
    }

    return new Promise((res, rej) => {
      const processDelegators = async (delegatorId: string, cb: any): Promise<void> => {
        const zeroDelegator: any = await apiAtOriginalPrior.query.parachainStaking.delegatorState(delegatorId);
        zeroDelegator.unwrap().delegations.forEach((delegation: any) => {
          const collatorId = delegation.owner.toHex();
          if (stakedValue[collatorId] && stakedValue[collatorId].delegators[delegatorId]) {
            newStakedValue[collatorId].delegators[delegatorId].amount = delegation.amount;
          }
        });
        cb();
      };

      const queue = new Queue(processDelegators, { concurrent: 50 });
      for (const delegatorId of Array.from(delegators)) {
        queue.push(delegatorId);
      }
      queue.on('drain', () => {
        res(newStakedValue);
      });
      queue.on('task_failed', (taskId: any, err: any, stats: any) => {
        console.error('Queue task failed', taskId, err, stats);
        rej();
      });
    });
  }

  async getRewardedFromEventsAtBlock(
    specVersion: number,
    rewardedBlockNumber: BN,
    delegators: Set<string>,
    collators: Set<string>,
    totalCollatorCommissionReward: BN,
    totalPoints: BN,
    totalStakingReward: BN,
    stakedValue: StakedValue,
  ): Promise<Rewarded> {
    const nowRoundRewardBlockHash: BlockHash = await this.api.rpc.chain.getBlockHash(rewardedBlockNumber);
    const apiAtBlock = await this.api.at(nowRoundRewardBlockHash);

    logger.info({
      event: 'RoundPayoutProcessor.getRewardedFromEventsAtBlock',
      message: `> block ${rewardedBlockNumber} (${nowRoundRewardBlockHash})`,
    });

    const rewardedBlockTime: any = await apiAtBlock.query.timestamp.now();

    const rewards: { [key: string]: { account: string; amount: u128 } } = {};
    const blockEvents: [{ event: any, phase: any }] = await apiAtBlock.query.system.events() as any;
    // let rewardCount = 0;

    for (const { phase, event } of blockEvents) {
      if (phase.isInitialization && apiAtBlock.events.parachainStaking.Rewarded.is(event)) {
        // rewardCount++;
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
        if (!rewards[accountId].amount.isZero()) {
          if (!collatorInfo.delegators) {
            throw new Error('collator was not paid before the delegator (possibly not at all)');
          }

          const bondShare = new Perbill(collatorInfo.delegators[accountId].amount, collatorInfo.total);
          totalBondRewardShare = totalBondRewardShare.add(bondShare.value());
          const delegatorReward = bondShare.of(bondReward);
          rewarded.amount.bondReward = rewarded.amount.bondReward.add(delegatorReward);
          rewarded.delegators.push({
            id: accountId,
            reward: delegatorReward,
          });
          // this.assertEqualWithAccount(rewards[accountId].amount, delegatorReward, `${accountId} (DEL)`);
        }
      } else {
        //      if (!(
        //        (accountId === '0x6ac4b6725efd8a1cb397884769730094e854efd4' && rewardedBlockNumber.toNumber() === 640219) ||
        //        (accountId === '0x5d9bc481749420cffb2bf5aef5c5e2a0ffe04e88' && rewardedBlockNumber.toNumber() === 1061443)
        // )) {
        // throw Error(`invalid key ${accountId}, neither collator not delegator`);
        // }

        logger.error({
          event: 'RoundPayoutProcessor.getRewardedFromEventsAtBlock',
          error: `Error processing stake for round at block ${rewardedBlockNumber}.
                  Invalid key ${accountId}, neither collator not delegator`,
        });
      }
    }

    return rewarded;
  }

  assertEqualWithAccount(a: BN, b: BN, account: string) {
    const diff = a.sub(b);
    if (!diff.abs().isZero()) {
      throw Error(`${account} ${a.toString()} != ${b.toString()}, difference of ${diff.abs().toString()}`);
    }
  }
}

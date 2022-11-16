
// eslint-disable no-continue */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
/* eslint no-console: ["error", { allow: ["warn", "error"] }] */
/* eslint no-constant-condition: ["error", { "checkLoops": false }] */

import Queue from 'better-queue'
import { ApiPromise } from '@polkadot/api'
import { BN } from '@polkadot/util'
import type { u128, u32 } from '@polkadot/types-codec'
import { Moment, SignedBlock, BlockHash } from '@polkadot/types/interfaces'
import { logger } from '@/loaders/logger'
import { environment } from '@/environment'
import {
  StakedValue,
  StakedValueData,
  RoundValue
} from './interfaces'


export class MoonbeamStakingProcessorRoundPayout {
  api: ApiPromise;

  isDebug = true;

  stakedValue: StakedValue = {};

  collators: Set<string>;
  delegators: Set<string>;

  totalRewardedAmount: BN;

  specVersion = 0;

  constructor(
    api: ApiPromise,
  ) {
    this.api = api

    this.collators = new Set()
    this.delegators = new Set()

    this.totalRewardedAmount = new BN(0)
  }


  async getRewards(
    nowBlockNumber: number,
  ): Promise<{ round: RoundValue }> {
    const latestBlock: SignedBlock = await this.api.rpc.chain.getBlock() as SignedBlock
    // const latestBlockHash: HexString = latestBlock.block.hash;
    const latestBlockNumber = latestBlock.block.header.number.toNumber()
    // const latestRound: any = await (await this.api.at(latestBlockHash)).query.parachainStaking.round();
    const nowBlockHash: BlockHash = await this.api.rpc.chain.getBlockHash(nowBlockNumber)
    const apiAtNowBlock = await this.api.at(nowBlockHash)
    const nowRound: any = await apiAtNowBlock.query.parachainStaking.round()
    const nowRoundNumber = nowRound.current
    const nowRoundFirstBlock = nowRound.first
    const nowRoundFirstBlockTime: Moment = await apiAtNowBlock.query.timestamp.now() as Moment
    const nowRoundFirstBlockHash: BlockHash = await this.api.rpc.chain.getBlockHash(nowRoundFirstBlock)
    const apiAtRewarded = await this.api.at(nowRoundFirstBlockHash)
    const rewardDelay = apiAtRewarded.consts.parachainStaking?.rewardPaymentDelay || new BN(2)
    const priorRewardedBlockHash: BlockHash = await this.api.rpc.chain.getBlockHash(nowRoundFirstBlock.subn(1))
    const runtime: any = await apiAtRewarded.query.system.lastRuntimeUpgrade()
    this.specVersion = runtime.unwrap().specVersion.toNumber()

    // obtain data from original round
    const rewardRound: any = await apiAtRewarded.query.parachainStaking.round()
    const originalRoundNumber = rewardRound.current.sub(rewardDelay)
    let originalRoundBlock = nowRoundFirstBlock.toBn()
    while (true) {
      const blockHash: BlockHash = await this.api.rpc.chain.getBlockHash(originalRoundBlock)
      const round: any = await (await this.api.at(blockHash)).query.parachainStaking.round()
      if (
        round.current.eq(originalRoundNumber)
        || originalRoundBlock.sub(round.length).toNumber() < 0
      ) {
        break
      }
      // go previous round
      originalRoundBlock = originalRoundBlock.sub(round.length)
    }

    logger.info({
      event: `Round ${originalRoundNumber.toString(10)} runtime version is ${this.specVersion}.`,
    })

    if (originalRoundBlock.toNumber() === 0) {
      throw new Error(
        `Couldn't process round. Because originalRoundBlock is 0`
      )
    }

    const originalRoundBlockHash: BlockHash = await this.api.rpc.chain.getBlockHash(originalRoundBlock)
    const apiAtOriginal: any = await this.api.at(originalRoundBlockHash)
    const originalRoundBlockTime: Moment = await apiAtOriginal.query.timestamp.now()

    // we go to the last block of the (original round - 1) since data is snapshotted at round start.
    const originalRoundPriorBlock = originalRoundBlock.subn(1)
    const originalRoundPriorBlockHash: BlockHash = await this.api.rpc.chain.getBlockHash(originalRoundPriorBlock)
    const apiAtOriginalPrior: any = await this.api.at(originalRoundPriorBlockHash)
    const apiAtPriorRewarded: any = await this.api.at(priorRewardedBlockHash)

    logger.info({
      event: 'RoundPayoutProcessor.getRewards',
      message: 'Rounds info',
      originalRoundNumber: originalRoundNumber.toString(),
      originalRoundPriorBlock: originalRoundPriorBlock.toNumber(),
      paidRoundNumber: nowRoundNumber.toString(),
      nowRoundFirstBlock: nowRoundFirstBlock.toNumber(),
    })

    // collect info about staked value from collators and delegators
    await this.getCollatorsAndDelegators(apiAtOriginalPrior, apiAtPriorRewarded, originalRoundNumber)

    logger.info({
      event: 'RoundPayoutProcessor.getRewards',
      message: `Collators count: ${Object.keys(this.stakedValue).length}; Delegators count: ${this.delegators.size}`,
    })

    // calculate reward amounts
    // const parachainBondInfo: any = await apiAtPriorRewarded.query.parachainStaking.parachainBondInfo()
    // const parachainBondPercent = new Percent(parachainBondInfo.percent)
    const totalStaked: any = await apiAtPriorRewarded.query.parachainStaking.staked(originalRoundNumber)
    const totalPoints: any = await apiAtPriorRewarded.query.parachainStaking.points(originalRoundNumber)
    // const inflation: any = await apiAtPriorRewarded.query.parachainStaking.inflationConfig()
    // const totalIssuance: BN = await apiAtPriorRewarded.query.balances.totalIssuance() as BN
    // const collatorCommissionRate: any = await apiAtPriorRewarded.query.parachainStaking.collatorCommission()

    /*
    const range = {
      min: new Perbill(inflation.round.min).of(totalIssuance),
      ideal: new Perbill(inflation.round.ideal).of(totalIssuance),
      max: new Perbill(inflation.round.max).of(totalIssuance),
    }
    */

    /*
    const totalRoundIssuance = (() => {
      if (totalStaked.lt(inflation.expect.min)) {
        return range.min
      } if (totalStaked.gt(inflation.expect.max)) {
        return range.max
      }
      return range.ideal
    })()
    */
    //const totalCollatorCommissionReward = new Perbill(collatorCommissionRate).of(totalRoundIssuance)

    // calculate total staking reward
    /*
    const firstBlockRewardedEvents: any = await apiAtRewarded.query.system.events()
    let reservedForParachainBond = new BN(0)
    for (const { phase, event } of firstBlockRewardedEvents) {
      if (phase.isInitialization) {
        // only deduct parachainBondReward if it was transferred (event must exist)
        if (apiAtRewarded.events.parachainStaking.ReservedForParachainBond.is(event)) {
          reservedForParachainBond = event.data[1] as any
          break;
        }
      }
    }
    */

    // total expected staking reward minus the amount reserved for parachain bond
    /*
    const totalStakingReward = (() => {
      const parachainBondReward = parachainBondPercent.of(totalRoundIssuance)
      if (!reservedForParachainBond.isZero()) {
        // expect(
        //   parachainBondReward.eq(reservedForParachainBond),
        //  `parachain bond amount does not match \
        //    ${parachainBondReward.toString()} != ${reservedForParachainBond.toString()} \
        //    for round ${originalRoundNumber.toString()}`
        // ).to.be.true;
        return totalRoundIssuance.sub(parachainBondReward)
      }

      return totalRoundIssuance
    })()
    */

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
    ).map((awarded: any) => awarded.args[1].toHex())
    const awardedCollatorCount = awardedCollators.length

    // compute max rounds respecting the current block number and the number of awarded collators
    const maxRoundChecks = (this.specVersion <= 1002) ?
      1 :
      Math.min(latestBlockNumber - nowBlockNumber + 1, awardedCollatorCount)

    logger.info({
      event: 'RoundPayoutProcessor.getRewards',
      message: `verifying ${maxRoundChecks} blocks for rewards (awarded ${awardedCollatorCount})`,
    })

    // accumulate collator share percentages
    //let totalCollatorShare = new BN(0);
    // accumulate total rewards given to collators & delegators due to bonding
    //let totalBondRewarded = new BN(0);
    // accumulate total commission rewards per collator
    //let totalCollatorCommissionRewarded = new BN(0);


    // iterate over the next blocks to verify rewards
    for await (const i of new Array(maxRoundChecks).keys()) {
      const blockNumber = nowRoundFirstBlock.addn(i)
      await this.getRewardedFromEventsAtBlock(
        blockNumber,
        //totalCollatorCommissionReward,
        //totalPoints,
        //totalStakingReward,
      )
      //totalRewardedAmount = totalRewardedAmount.add(rewarded.amount.total);

      /*
      if (rewarded.collator) {
        totalCollatorShare = totalCollatorShare.add(rewarded.amount.collatorSharePerbill);
        totalCollatorCommissionRewarded = totalCollatorCommissionRewarded.add(
          rewarded.amount.commissionReward,
        );
        totalRewardedAmount = totalRewardedAmount.add(rewarded.amount.total);
        // totalRewardedPoints = totalRewardedPoints.add(rewarded.amount.total);
        totalBondRewarded = totalBondRewarded.add(rewarded.amount.bondReward);
        // totalBondRewardedLoss = totalBondRewardedLoss.add(rewarded.amount.bondRewardLoss);

        this.stakedValue[rewarded.collator].reward = rewarded.amount;
        this.stakedValue[rewarded.collator].payoutBlockId = rewarded.payoutBlockId;
        this.stakedValue[rewarded.collator].payoutBlockTime = rewarded.payoutBlockTime;

        for (const delegator of rewarded.delegators) {
          if (this.stakedValue[rewarded.collator].delegators[delegator.id]) {
            this.stakedValue[rewarded.collator].delegators[delegator.id].reward = delegator.reward;
          }
        }
      }
      */
    }

    return {
      round: {
        id: originalRoundNumber,
        payoutBlockId: nowRoundFirstBlock.toNumber(),
        payoutBlockTime: nowRoundFirstBlockTime,
        startBlockId: originalRoundBlock.toNumber(),
        startBlockTime: originalRoundBlockTime,
        //totalCollatorShare,
        //totalCollatorCommissionRewarded,
        //totalRewardedAmount,
        totalPoints,
        totalStaked,
        //totalBondRewarded,
        //specVersion,
        // totalBondRewardedLoss,
      },
    }
  }

  async getCollatorsAndDelegators(apiAtOriginalPrior: ApiPromise, apiAtPriorRewarded: ApiPromise, roundNumber: number): Promise<void> {

    //interfae StakeEntry {
    //  [{ args: [, accountId] }, { bond, total, delegations }]
    //}

    //:[StorageKey < AnyTuple >, Codec][] 
    const atStake: any = await apiAtPriorRewarded.query.parachainStaking.atStake.entries(
      roundNumber,
    )

    //console.log(atStake);

    for (const [{ args: [, accountId] }, { bond, total, delegations, nominators }] of atStake) {
      const collatorId = accountId.toHex()
      this.collators.add(collatorId)
      const points: u32 = await apiAtPriorRewarded.query.parachainStaking.awardedPts(
        roundNumber,
        accountId,
      ) as u32

      //console.log(nominators.toHuman());

      const collatorInfo: StakedValueData = {
        id: collatorId,
        bond,
        total,
        points,
        delegators: {},
        rewardTotal: new BN(0),
        rewardCollator: new BN(0),
      }

      const topDelegationsSet = new Set()
      if (apiAtOriginalPrior.query.parachainStaking.topDelegations) {
        const accountDelegations: any = (await apiAtOriginalPrior.query.parachainStaking.topDelegations(accountId))
        const topDelegations = accountDelegations
          .unwrap()
          .delegations

        if (topDelegations) {
          for (const d of topDelegations) {
            topDelegationsSet.add(d.owner.toHex())
          }
        }
      }
      if (delegations) {
        for (const { owner, amount } of delegations) {
          if (apiAtOriginalPrior.query.parachainStaking.topDelegations && !topDelegationsSet.has(owner.toHex())) {
            continue
          }
          const id = owner.toHex()
          this.delegators.add(id)
          collatorInfo.delegators[id] = {
            id,
            final_amount: amount,
            amount,
            reward: new BN(0),
          }
          // countedDelegationSum = countedDelegationSum.add(amount);
        }
      }
      if (nominators) {
        for (const { owner, amount } of nominators) {
          const id = owner.toHex()
          this.delegators.add(id)
          collatorInfo.delegators[id] = {
            id,
            final_amount: amount,
            amount,
            reward: new BN(0),
          }
          // countedDelegationSum = countedDelegationSum.add(amount);
        }
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

      this.stakedValue[collatorId] = collatorInfo
    }

    //console.log(this.stakedValue['0x3abeda9f0f920fda379b59b042dd6625d9c86df3']);

    await this.fixZeroDelegatorsStakeQueue(apiAtOriginalPrior)

  }

  async fixZeroDelegatorsStakeQueue(apiAtOriginalPrior: ApiPromise): Promise<void> {

    if (!this.delegators.size) { // TODO: remove it
      return
    }

    if (!apiAtOriginalPrior.query.parachainStaking.delegatorState) {
      return
    }

    return new Promise((res, rej) => {
      const processDelegators = async (delegatorId: string, cb: any): Promise<void> => {
        const zeroDelegator: any = await apiAtOriginalPrior.query.parachainStaking.delegatorState(delegatorId)
        zeroDelegator.unwrap().delegations.forEach((delegation: any) => {
          const collatorId = delegation.owner.toHex()
          if (this.stakedValue[collatorId] && this.stakedValue[collatorId].delegators[delegatorId]) {
            this.stakedValue[collatorId].delegators[delegatorId].amount = delegation.amount
          }
        })
        cb()
      }

      const queue = new Queue(processDelegators, { concurrent: 50 })
      for (const delegatorId of Array.from(this.delegators)) {
        queue.push(delegatorId)
      }
      queue.on('drain', () => {
        res()
      })
      queue.on('task_failed', (taskId: any, err: any, stats: any) => {
        console.error('Queue task failed', taskId, err, stats)
        rej()
      })
    })
  }

  async getRewardedFromEventsAtBlock(
    rewardedBlockNumber: BN,
    //totalCollatorCommissionReward: BN,
    //totalPoints: BN,
    //totalStakingReward: BN,
  ): Promise<void> {
    const nowRoundRewardBlockHash: BlockHash = await this.api.rpc.chain.getBlockHash(rewardedBlockNumber)
    const apiAtBlock = await this.api.at(nowRoundRewardBlockHash)

    logger.info({
      event: 'RoundPayoutProcessor.getRewardedFromEventsAtBlock',
      message: `> block ${rewardedBlockNumber} (${nowRoundRewardBlockHash})`,
    })

    const rewardedBlockTime: any = await apiAtBlock.query.timestamp.now()

    const rewards: { [key: string]: Array<{ account: string; collator_id?: string; amount: u128 }> } = {}
    const blockEvents: [{ event: any, phase: any }] = await apiAtBlock.query.system.events() as any
    // let rewardCount = 0;

    for (const { phase, event } of blockEvents) {
      if (!event.data || !event.data[0]) {
        continue
      }

      if (!rewards[event.data[0].toHex()]) {
        rewards[event.data[0].toHex()] = []
      }

      if (phase.isInitialization && apiAtBlock.events.parachainStaking.Rewarded.is(event)) {
        rewards[event.data[0].toHex()].push({
          account: event.data[0].toHex(),
          amount: event.data[1] as u128,
        })
      }

      //runtime 1001
      if (
        phase.isInitialization &&
        apiAtBlock.events.parachainStaking.DelegatorDueReward &&
        apiAtBlock.events.parachainStaking.DelegatorDueReward.is(event)
      ) {
        rewards[event.data[0].toHex()].push({
          account: event.data[0].toHex(),
          collator_id: event.data[1].toHex(),
          amount: event.data[2] as u128,
        })
      }
    }

    let bondReward: BN = new BN(0)
    let amountTotal: BN = new BN(0)
    let collatorInfo: any = {}
    /*
    const rewarded: any = {
      //collator: null,
      //delegators: new Array<DelegatorReward>(),
      //payoutBlockId: rewardedBlockNumber,
      //payoutBlockTime: rewardedBlockTime.toNumber(),
      amount: {
        total: new BN(0),
        //commissionReward: new BN(0),
        //bondReward: new BN(0),
        // bondRewardLoss: new BN(0),
        //collatorSharePerbill: new BN(0),
      },
    };
    */
    let totalBondRewardShare = new BN(0)

    //collators rewards
    Object.keys(rewards).forEach(accountId => {
      rewards[accountId].forEach(reward => {

        amountTotal = amountTotal.add(reward.amount)
        this.totalRewardedAmount = this.totalRewardedAmount.add(amountTotal)

        if (this.collators.has(accountId)) {
          console.log("COLLATOR", this.specVersion, accountId)
          // collator is always paid first so this is guaranteed to execute first
          collatorInfo = this.stakedValue[accountId]


          this.stakedValue[accountId].rewardTotal = amountTotal
          this.stakedValue[accountId].rewardCollator = reward.amount //collatorReward.toString(10)
          this.stakedValue[accountId].payoutBlockId = rewardedBlockNumber
          this.stakedValue[accountId].payoutBlockTime = rewardedBlockTime.toNumber()
        }
      })
    })


    //delegators rewards
    Object.keys(rewards).forEach(accountId => {
      rewards[accountId].forEach(reward => {
        if (this.delegators.has(accountId)) {

          console.log("DELEGATOR", this.specVersion, accountId, reward.amount.toString(10))



          if (reward.amount.isZero()) {
            return
          }

          //if (this.specVersion <= 1001 && !reward.collator_id) {
          //            return
          //}

          if (this.specVersion === 1001 || this.specVersion === 1002) {
            if (reward.collator_id) { //runtime 1001, otherwise it should be defined in previous step.
              collatorInfo = this.stakedValue[reward.collator_id]
            } else {
              return
            }
          } else if (this.specVersion <= 900) {
            for (const collator of Object.values(this.stakedValue)) {
              if (!collator.rewardCollator.isZero() && collator.delegators[accountId] && collator.delegators[accountId].reward.isZero()) {
                collatorInfo = collator
                break
              }
            }
          }

          //console.log(collatorInfo.id);

          /*
          
          */

          if (!collatorInfo || !collatorInfo.delegators || !collatorInfo.delegators[accountId]) {
            if (
              (environment.NETWORK_ID === 25 && rewardedBlockNumber.toNumber() === 504000) ||
              (environment.NETWORK_ID === 25 && rewardedBlockNumber.toNumber() === 1044000)
            ) {
              return
            }
            throw new Error(`Could not find collator for delegator ${accountId}`)
          }

          //console.log(2222);

          this.stakedValue[collatorInfo.id].delegators[accountId].reward = reward.amount//delegatorReward
        }
      })
    })

  }


  assertEqualWithAccount(a: BN, b: BN, account: string) {
    const diff = a.sub(b)
    if (!diff.abs().isZero()) {
      throw Error(`${account} ${a.toString()} != ${b.toString()}, difference of ${diff.abs().toString()}`)
    }
  }
}

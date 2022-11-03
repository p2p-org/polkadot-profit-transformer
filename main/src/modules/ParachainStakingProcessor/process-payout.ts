/* eslint-disable import/no-extraneous-dependencies */
// eslint-disable no-continue */
/* eslint-disable class-methods-use-this */
/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
/* eslint no-console: ["error", { allow: ["warn", "error"] }] */
/* eslint no-constant-condition: ["error", { "checkLoops": false }] */

import { Knex } from 'knex'
import Queue from 'better-queue'
import { ApiPromise } from '@polkadot/api'
import { BN } from '@polkadot/util'
import type { HexString } from '@polkadot/util/types'
import type { u128, u32 } from '@polkadot/types-codec'
import { Moment, SignedBlock, BlockHash } from '@polkadot/types/interfaces'
import { logger } from '@/loaders/logger'
import { StakingRepository } from '@/apps/common/infra/postgresql/staking.repository'
import {
  DelegatorReward,
  Rewarded,
  StakedValueData,
  StakedValue,
  RoundValue,
  Perbill,
  Percent,
} from './interfaces'

export default class RoundPayoutProcessor {
  api: ApiPromise;

  isDebug = true;

  stakedValue: StakedValue = {};
  stakingRepository: StakingRepository;

  collators: Set<string>;
  delegators: Set<string>;

  totalRewardedAmount: BN;

  specVersion = 0;

  constructor(api: ApiPromise, stakingRepository: StakingRepository) {
    this.api = api
    this.stakingRepository = stakingRepository

    this.collators = new Set()
    this.delegators = new Set()

    this.totalRewardedAmount = new BN(0)
  }

  async processRoundPayout(
    payoutBlockId: number,
    trx: Knex.Transaction,
  ): Promise<void> {
    const start = Date.now()
    logger.info({
      event: 'RoundPayoutProcessor.processRoundPayout',
      message: `Process staking payout for round with payout block id: ${payoutBlockId}`,
    })

    try {
      const { round } = await this.getRewards(payoutBlockId)
      console.log(this.stakedValue)


      logger.info({
        event: 'RoundPayoutProcessor.processRoundPayout',
        message: 'Round processed',
        round_id: parseInt(round.id.toString(10), 10),
        payout_block_id: round.payoutBlockId,
        payout_block_time: new Date(parseInt(round.payoutBlockTime.toString(10), 10)),
        start_block_id: round.startBlockId,
        start_block_time: new Date(parseInt(round.startBlockTime.toString(10), 10)),
        total_reward: this.totalRewardedAmount.toString(10),
        total_stake: round.totalStaked.toString(),
        total_reward_points: parseInt(round.totalPoints.toString(), 10),
        collators_count: Object.keys(this.stakedValue).length,
        runtime: this.specVersion,
      })


      await this.stakingRepository(trx).round.save({
        round_id: parseInt(round.id.toString(10), 10),
        payout_block_id: round.payoutBlockId,
        payout_block_time: new Date(parseInt(round.payoutBlockTime.toString(10), 10)),
        start_block_id: round.startBlockId,
        start_block_time: new Date(parseInt(round.startBlockTime.toString(10), 10)),
        total_reward: this.totalRewardedAmount.toString(10),
        total_stake: round.totalStaked.toString(),
        total_reward_points: parseInt(round.totalPoints.toString(), 10),
        collators_count: Object.keys(this.stakedValue).length,
        runtime: this.specVersion,
      })

      for (const collator of Object.values(this.stakedValue) as any) {
        await this.stakingRepository(trx).collators.save({
          round_id: parseInt(round.id.toString(10), 10),
          account_id: collator.id,
          total_stake: collator.total.toString(10),
          own_stake: collator.bond.toString(10),
          delegators_count: Object.keys(collator.delegators).length,
          total_reward_points: parseInt(collator.points.toString(10), 10),
          total_reward: collator.rewardTotal && collator.rewardTotal ? collator.rewardTotal.toString(10) : '0',
          collator_reward: collator.rewardCollator && collator.rewardCollator ? collator.rewardCollator.toString(10) : '0',
          payout_block_id: collator.payoutBlockId ? parseInt(collator.payoutBlockId, 10) : undefined,
          payout_block_time: collator.payoutBlockTime ? new Date(collator.payoutBlockTime) : undefined,
        })

        for (const delegator of Object.values(collator.delegators) as any) {
          await this.stakingRepository(trx).delegators.save({
            round_id: parseInt(round.id.toString(10), 10),
            account_id: delegator.id,
            collator_id: collator.id,
            amount: delegator.amount.toString(10),
            final_amount: delegator.final_amount.toString(10),
            reward: delegator.reward.toString(10),
            payout_block_id: collator.payoutBlockId ? parseInt(collator.payoutBlockId, 10) : undefined,
            payout_block_time: collator.payoutBlockTime ? new Date(collator.payoutBlockTime) : undefined,
          })
        }
      }

      const finish = Date.now()

      logger.info({
        event: `Round ${round.id.toString(10)} staking processing finished in ${(finish - start) / 1000} seconds.`,
      })
    } catch (error: any) {
      console.error(error)
      logger.warn({
        event: 'RoundPayoutProcessor.processRoundPayout',
        error: `error in processing round staking: ${error.message}`,
      })
      throw error
    }
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
    const rewardDelay = apiAtRewarded.consts.parachainStaking.rewardPaymentDelay
    const priorRewardedBlockHash: BlockHash = await this.api.rpc.chain.getBlockHash(nowRoundFirstBlock.subn(1))
    const runtime: any = await apiAtRewarded.query.system.lastRuntimeUpgrade()
    this.specVersion = runtime.unwrap().specVersion.toNumber()

    // obtain data from original round
    const rewardRound: any = await apiAtRewarded.query.parachainStaking.round()
    const originalRoundNumber = rewardRound.current.sub(
      rewardDelay,
    )
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
      message: `Collators count: ${Object.keys(this.stakedValue).length}`,
    })

    // calculate reward amounts
    const parachainBondInfo: any = await apiAtPriorRewarded.query.parachainStaking.parachainBondInfo()
    const parachainBondPercent = new Percent(parachainBondInfo.percent)
    const totalStaked: any = await apiAtPriorRewarded.query.parachainStaking.staked(originalRoundNumber)
    const totalPoints: any = await apiAtPriorRewarded.query.parachainStaking.points(originalRoundNumber)
    const inflation: any = await apiAtPriorRewarded.query.parachainStaking.inflationConfig()
    const totalIssuance: BN = await apiAtPriorRewarded.query.balances.totalIssuance() as BN
    const collatorCommissionRate: any = await apiAtPriorRewarded.query.parachainStaking.collatorCommission()

    const range = {
      min: new Perbill(inflation.round.min).of(totalIssuance),
      ideal: new Perbill(inflation.round.ideal).of(totalIssuance),
      max: new Perbill(inflation.round.max).of(totalIssuance),
    }

    const totalRoundIssuance = (() => {
      if (totalStaked.lt(inflation.expect.min)) {
        return range.min
      } if (totalStaked.gt(inflation.expect.max)) {
        return range.max
      }
      return range.ideal
    })()
    const totalCollatorCommissionReward = new Perbill(collatorCommissionRate).of(totalRoundIssuance)

    // calculate total staking reward
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

    // total expected staking reward minus the amount reserved for parachain bond
    const totalStakingReward = (() => {
      const parachainBondReward = parachainBondPercent.of(totalRoundIssuance)
      if (!reservedForParachainBond.isZero()) {
        /*
        expect(
          parachainBondReward.eq(reservedForParachainBond),
          `parachain bond amount does not match \
            ${parachainBondReward.toString()} != ${reservedForParachainBond.toString()} \
            for round ${originalRoundNumber.toString()}`
        ).to.be.true;
        */
        return totalRoundIssuance.sub(parachainBondReward)
      }

      return totalRoundIssuance
    })()

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
    const maxRoundChecks = (this.specVersion <= 1001) ?
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
        totalCollatorCommissionReward,
        totalPoints,
        totalStakingReward,
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

    for (const [{ args: [, accountId] }, { bond, total, delegations }] of atStake) {
      const collatorId = accountId.toHex()
      this.collators.add(collatorId)
      const points: u32 = await apiAtPriorRewarded.query.parachainStaking.awardedPts(
        roundNumber,
        accountId,
      ) as u32

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
      };

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
    totalCollatorCommissionReward: BN,
    totalPoints: BN,
    totalStakingReward: BN,
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

    for (const accountId of Object.keys(rewards) as HexString[]) {
      rewards[accountId].forEach(reward => {

        amountTotal = amountTotal.add(reward.amount)
        this.totalRewardedAmount = this.totalRewardedAmount.add(amountTotal)

        if (this.collators.has(accountId)) {
          console.log("COLLATOR", this.specVersion, accountId)
          // collator is always paid first so this is guaranteed to execute first
          collatorInfo = this.stakedValue[accountId]

          const pointsShare = new Perbill(collatorInfo.points, totalPoints)
          const collatorReward = pointsShare.of(totalStakingReward)
          //rewarded.amount.collatorSharePerbill = pointsShare.value();
          const collatorCommissionReward = pointsShare.of(totalCollatorCommissionReward)
          //rewarded.amount.commissionReward = collatorCommissionReward;
          bondReward = collatorReward.sub(collatorCommissionReward)

          if (!this.stakedValue[accountId].delegators) {
            this.assertEqualWithAccount(reward.amount, collatorReward, `${accountId} (COL)`)
          } else {
            const bondShare = new Perbill(collatorInfo.bond, collatorInfo.total)
            totalBondRewardShare = totalBondRewardShare.add(bondShare.value())
            const collatorBondReward = bondShare.of(bondReward)
            //rewarded.amount.bondReward = rewarded.amount.bondReward.add(collatorBondReward);
            const collatorTotalReward = collatorBondReward.add(collatorCommissionReward)
            this.assertEqualWithAccount(
              reward.amount,
              collatorTotalReward,
              `${accountId} (COL)`,
            )
          }
          //rewarded.collator = accountId;

          this.stakedValue[accountId].rewardTotal = amountTotal
          this.stakedValue[accountId].rewardCollator = collatorReward
          this.stakedValue[accountId].payoutBlockId = rewardedBlockNumber
          this.stakedValue[accountId].payoutBlockTime = rewardedBlockTime.toNumber()



        } else if (this.delegators.has(accountId)) {

          console.log("DELEGATOR", this.specVersion, accountId)

          if (reward.amount.isZero()) {
            return
          }

          if (this.specVersion <= 1001 && !reward.collator_id) {
            return
          }

          if (reward.collator_id) { //runtime 1001, otherwise it should be defined in previous step.
            collatorInfo = this.stakedValue[reward.collator_id]
          } else if (!collatorInfo.delegators) {
            throw new Error('collator was not paid before the delegator (possibly not at all)')
          }

          if (!collatorInfo.delegators[accountId]) {
            throw new Error(`could not find ${accountId} in delegators list of collator ${collatorInfo.id}`)
          }

          const bondShare = new Perbill(collatorInfo.delegators[accountId].amount, collatorInfo.total)
          const delegatorReward = bondShare.of(bondReward)
          this.stakedValue[collatorInfo.id].delegators[accountId].reward = delegatorReward

          if (accountId === '0x8fe53e72da65b7283680534c7b9d14c769893adc' &&
            reward.collator_id === '0x58ded8ae0222d49d55db3c47a5603893118a52af'
          ) {
            console.log(rewards[accountId])
            console.log(this.stakedValue[collatorInfo.id])
            console.log(collatorInfo.total)
            console.log(reward)
            console.log("delegatorReward", delegatorReward.toNumber())

          }

          // this.assertEqualWithAccount(rewards[accountId].amount, delegatorReward, `${accountId} (DEL)`);
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
          })
        }
      })
    }
  }


  assertEqualWithAccount(a: BN, b: BN, account: string) {
    const diff = a.sub(b)
    if (!diff.abs().isZero()) {
      throw Error(`${account} ${a.toString()} != ${b.toString()}, difference of ${diff.abs().toString()}`)
    }
  }
}

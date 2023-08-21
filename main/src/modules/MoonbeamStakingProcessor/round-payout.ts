/* eslint-disable no-continue */
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
import { sleep } from '@/utils/sleep'
import { StakedValue, StakedValueData, RoundValue } from './interfaces'
import { fstat } from 'fs'
import BlockMetadataProcessor from '../BlockMetadataProcessor'

export class MoonbeamStakingProcessorRoundPayout {
  api: ApiPromise

  isDebug = true

  stakedValue: StakedValue = {}

  collators: Set<string>
  delegators: Set<string>

  totalRewardedAmount: BN

  specVersion = 0

  constructor(api: ApiPromise) {
    this.api = api

    this.collators = new Set()
    this.delegators = new Set()

    this.totalRewardedAmount = new BN(0)

    setInterval(() => {
      this.api.rpc.chain.getBlockHash(1000000)
    }, 60 * 1000)
  }

  async getStakeRound(nowBlockNumber: number): Promise<{ round: RoundValue }> {
    const originalRoundBlock = new BN(nowBlockNumber)
    const originalRoundBlockHash: BlockHash = await this.api.rpc.chain.getBlockHash(originalRoundBlock)
    const apiAtOriginal: any = await this.api.at(originalRoundBlockHash)
    const originalRoundBlockTime: Moment = await apiAtOriginal.query.timestamp.now()
    const originalRound: any = await apiAtOriginal.query.parachainStaking.round()
    const originalRoundNumber = originalRound.current
    const runtime: any = await apiAtOriginal.query.system.lastRuntimeUpgrade()
    this.specVersion = runtime.unwrap().specVersion.toNumber()

    logger.info({
      event: `Round Stake ${originalRoundNumber.toString(10)} runtime version is ${this.specVersion}.`,
    })

    await this.getCollatorsAndDelegators(apiAtOriginal, apiAtOriginal, /*apiAtPriorRewarded, */ originalRoundNumber)

    logger.info({
      event: 'RoundPayoutProcessor.getStakeRound',
      message: `Collators count: ${Object.keys(this.stakedValue).length}; Delegators count: ${this.delegators.size}`,
    })

    // calculate reward amounts
    const totalStaked: any = await apiAtOriginal.query.parachainStaking.staked(originalRoundNumber)

    return {
      round: {
        id: originalRoundNumber,
        payoutBlockId: 0,
        payoutBlockTime: originalRoundBlockTime,
        startBlockId: originalRoundBlock.toNumber(),
        startBlockTime: originalRoundBlockTime,
        totalStaked,
        totalPoints: new BN(0),
      },
    }
  }

  async getRewardsRound(nowBlockNumber: number): Promise<{ round: RoundValue }> {
    const latestBlock: SignedBlock = (await this.api.rpc.chain.getBlock()) as SignedBlock
    const latestBlockNumber = latestBlock.block.header.number.toNumber()
    const nowBlockHash: BlockHash = await this.api.rpc.chain.getBlockHash(nowBlockNumber)
    const apiAtNowBlock = await this.api.at(nowBlockHash)
    const nowRound: any = await apiAtNowBlock.query.parachainStaking.round()
    const nowRoundNumber = nowRound.current
    const nowRoundFirstBlock = nowRound.first
    const nowRoundFirstBlockTime: Moment = (await apiAtNowBlock.query.timestamp.now()) as Moment
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
      if (round.current.eq(originalRoundNumber) || originalRoundBlock.sub(round.length).toNumber() < 0) {
        break
      }
      // go previous round
      originalRoundBlock = originalRoundBlock.sub(round.length)
    }

    logger.info({
      event: `Round ${originalRoundNumber.toString(10)} runtime version is ${this.specVersion}.`,
    })

    if (originalRoundBlock.toNumber() === 0) {
      throw new Error(`Couldn't process round. Because originalRoundBlock is 0`)
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

    console.log('originalRoundNumber', originalRoundNumber.toNumber())
    console.log('apiAtOriginalPrior', originalRoundPriorBlock.toNumber())
    console.log('apiAtPriorRewarded', nowRoundFirstBlock.subn(1).toNumber())
    //console.log("apiAtOriginalPrior", originalRoundNumber.toNumber());
    //console.log("apiAtPriorRewarded", originalRoundNumber.toNumber());
    // collect info about staked value from collators and delegators
    await this.getCollatorsAndDelegators(apiAtOriginalPrior, apiAtOriginal, /*apiAtPriorRewarded, */ originalRoundNumber)

    logger.info({
      event: 'RoundPayoutProcessor.getRewards',
      message: `Collators count: ${Object.keys(this.stakedValue).length}; Delegators count: ${this.delegators.size}`,
    })

    // calculate reward amounts
    const totalStaked: any = await apiAtOriginal.query.parachainStaking.staked(originalRoundNumber)
    const totalPoints: any = await apiAtPriorRewarded.query.parachainStaking.points(originalRoundNumber)

    // get the collators to be awarded via `awardedPts` storage
    const awardedCollators = (await apiAtPriorRewarded.query.parachainStaking.awardedPts.keys(originalRoundNumber)).map(
      (awarded: any) => awarded.args[1].toHex(),
    )
    const awardedCollatorCount = awardedCollators.length

    // compute max rounds respecting the current block number and the number of awarded collators
    let maxRoundChecks = 1
    if (this.specVersion > 1002) {
      if (awardedCollatorCount > latestBlockNumber - nowBlockNumber + 1) {
        await sleep(1000 * awardedCollatorCount * 15)
      }
      maxRoundChecks = awardedCollatorCount
    }
    if (this.specVersion >= 2000 && maxRoundChecks === 68) {
      maxRoundChecks = 72
    }

    logger.info({
      event: 'RoundPayoutProcessor.getRewards',
      message: `verifying ${maxRoundChecks} blocks for rewards (awarded ${awardedCollatorCount})`,
    })

    // iterate over the next blocks to verify rewards
    for await (const i of new Array(maxRoundChecks).keys()) {
      const blockNumber = nowRoundFirstBlock.addn(i)
      await this.getRewardedFromEventsAtBlock(blockNumber)
    }

    return {
      round: {
        id: originalRoundNumber,
        payoutBlockId: nowRoundFirstBlock.toNumber(),
        payoutBlockTime: nowRoundFirstBlockTime,
        startBlockId: originalRoundBlock.toNumber(),
        startBlockTime: originalRoundBlockTime,
        totalPoints,
        totalStaked,
      },
    }
  }

  async getCollatorsAndDelegators(
    apiAtOriginalPrior: ApiPromise,
    apiAtOriginal: ApiPromise,
    //apiAtPriorRewarded: ApiPromise,
    roundNumber: number,
  ): Promise<void> {
    const atStake: any = await apiAtOriginal.query.parachainStaking.atStake.entries(roundNumber)

    for (const [
      {
        args: [, accountId],
      },
      { bond, total, delegations, nominators },
    ] of atStake) {
      const collatorId = accountId.toHex()
      this.collators.add(collatorId)
      const points: u32 = (await apiAtOriginal.query.parachainStaking.awardedPts(roundNumber, accountId)) as u32

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
        const accountDelegations: any = await apiAtOriginalPrior.query.parachainStaking.topDelegations(accountId)
        const topDelegations = accountDelegations.unwrap().delegations

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
        }
      }

      this.stakedValue[collatorId] = collatorInfo
    }

    //require('fs').writeFileSync('student-6.json', JSON.stringify(this.stakedValue, null, 2));
    await this.fixZeroDelegatorsStakeQueue(apiAtOriginalPrior)
  }

  async fixZeroDelegatorsStakeQueue(apiAtOriginalPrior: ApiPromise): Promise<void> {
    if (!this.delegators.size) {
      // TODO: remove it
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
        logger.error({
          error: 'Queue task failed',
          taskId,
          err,
          stats,
        })
        rej()
      })
    })
  }

  async getRewardedFromEventsAtBlock(rewardedBlockNumber: BN): Promise<void> {
    const nowRoundRewardBlockHash: BlockHash = await this.api.rpc.chain.getBlockHash(rewardedBlockNumber)
    const apiAtBlock = await this.api.at(nowRoundRewardBlockHash)
    const apiAtPreviousBlock = await this.api.at(await this.api.rpc.chain.getBlockHash(rewardedBlockNumber.toNumber() - 1))
    const round: any = await apiAtBlock.query.parachainStaking.round()

    logger.info({
      event: 'RoundPayoutProcessor.getRewardedFromEventsAtBlock',
      message: `> block ${rewardedBlockNumber} (${nowRoundRewardBlockHash})`,
    })

    const rewardedBlockTime: any = await apiAtBlock.query.timestamp.now()

    const rewards: { [key: string]: Array<{ account: string; collator_id?: string; amount: u128 }> } = {}
    const blockEvents: [{ event: any; phase: any }] = (await apiAtBlock.query.system.events()) as any

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

      if (this.specVersion >= 2000) {
        // Now orbiters have their own event. To replicate previous behavior,
        // we take the collator associated and mark rewards as if they were
        // to the collator
        if (apiAtBlock.events.moonbeamOrbiters.OrbiterRewarded.is(event)) {
          // The orbiter is removed from the list at the block of the reward so we query the previous
          // block instead.
          // The round rewarded is 2 rounds before the current one.
          const orbiters = await apiAtPreviousBlock.query.moonbeamOrbiters.orbiterPerRound.entries(round.current.toNumber() - 2)
          const orbiter = orbiters.find((orbit) => orbit[1].toHex() == event.data[0].toHex())
          if (!orbiter || !orbiter.length) {
            throw new Error(`Collator for orbiter not found ${event.data[0].toHex()}`)
          }

          const accountId = `0x${orbiter[0].toHex().slice(-40)}`
          if (!rewards[accountId]) rewards[accountId] = []
          rewards[accountId].push({
            account: accountId,
            amount: event.data[1] as u128,
          })
        }
      }
    }

    let amountTotal: BN = new BN(0)
    let collatorInfo: any = {}

    Object.keys(rewards).forEach((accountId) => {
      rewards[accountId].forEach((reward) => {
        amountTotal = amountTotal.add(reward.amount)
        this.totalRewardedAmount = this.totalRewardedAmount.add(reward.amount)
      })
    })

    //collators rewards
    Object.keys(rewards).forEach((accountId) => {
      rewards[accountId].forEach((reward) => {
        if (this.collators.has(accountId)) {
          console.log('COLLATOR', this.specVersion, accountId, reward.amount.toString(10))
          // collator is always paid first so this is guaranteed to execute first
          collatorInfo = this.stakedValue[accountId]

          this.stakedValue[accountId].rewardTotal = amountTotal
          this.stakedValue[accountId].rewardCollator = reward.amount
          this.stakedValue[accountId].payoutBlockId = rewardedBlockNumber
          this.stakedValue[accountId].payoutBlockTime = rewardedBlockTime.toNumber()
        }
      })
    })

    //delegators rewards
    Object.keys(rewards).forEach((accountId) => {
      rewards[accountId].forEach((reward) => {
        if (this.delegators.has(accountId)) {
          if (reward.amount.isZero()) {
            return
          }

          if (this.specVersion === 1001 || this.specVersion === 1002) {
            if (reward.collator_id) {
              //runtime 1001, otherwise it should be defined in previous step.
              collatorInfo = this.stakedValue[reward.collator_id]
            } else {
              return
            }
          } else if (this.specVersion <= 900) {
            for (const collator of Object.values(this.stakedValue)) {
              if (
                !collator.rewardCollator.isZero() &&
                collator.delegators[accountId] &&
                collator.delegators[accountId].reward.isZero()
              ) {
                collatorInfo = collator
                break
              }
            }
          }

          if (!collatorInfo || !collatorInfo.delegators || !collatorInfo.delegators[accountId]) {
            if (
              (environment.NETWORK === 'moonriver' && rewardedBlockNumber.toNumber() === 504000) ||
              (environment.NETWORK === 'moonriver' && rewardedBlockNumber.toNumber() === 1044000)
            ) {
              return
            }
            throw new Error(`Could not find collator for delegator ${accountId}`)
            /*
            logger.error({
              error: `Could not find collator for delegator ${accountId}`,
            })
            return
            */
          }

          this.stakedValue[collatorInfo.id].delegators[accountId].reward = reward.amount
        }
      })
    })
  }
}

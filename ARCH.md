# Indexer Architecture — Technical Reference

> Scope: Polkadot / Kusama networks (including AssetHub variants).
> Covers: staking, nomination pools, identities, accounts, balances.

---

## 1. High-Level Overview

The indexer is a **multi-microservice Node.js/TypeScript application**. Each microservice is the same codebase but runs a different **mode**, selected via the `MODE` environment variable. Services share a **PostgreSQL** database and communicate through **RabbitMQ** message queues.

```
┌──────────────────┐     RabbitMQ      ┌────────────────────┐
│  BlockListener   │ ─── process_blocks ──► BlockProcessor   │
└──────────────────┘                   └────────────────────┘
                                              │
                              ┌───────────────┼────────────────────┐
                              ▼               ▼                    ▼
                    process_staking  process_nomination_pools  process_balances
                              │               │                    │
                    ┌─────────┴──────┐ ┌──────┴────────┐ ┌────────┴────────┐
                    │PolkadotStaking │ │NominationPools│ │BalancesProcessor│
                    │  Processor     │ │  Processor    │ └─────────────────┘
                    └────────────────┘ └───────────────┘

┌──────────────────────────────────┐
│  IdentityProcessor               │  ← polls DB directly (no RabbitMQ)
└──────────────────────────────────┘
```

---

## 2. Deployment Modes

Mode is set via `MODE` env var. Each pod/container runs exactly one mode.

| MODE | Services started |
|---|---|
| `LISTENER` | BlockListener |
| `BLOCK_PROCESSOR` | BlockProcessor |
| `STAKING_PROCESSOR` | PolkadotStakingProcessor + NominationPoolsProcessor |
| `IDENTITY_PROCESSOR` | IdentityProcessor |
| `BALANCES_PROCESSOR` | BalancesProcessor |
| `HYBRID` | BlockListener + BlockProcessor + IdentityProcessor |
| `MONITORING` | Monitoring service |

Network is set via `NETWORK` env var (e.g. `polkadot`, `kusama`, `polkadot-assethub`, `kusama-assethub`).

---

## 3. RabbitMQ — Queues & Message Format

### Connection

- Library: `amqp-connection-manager`
- Heartbeat: 180 seconds
- Reconnect interval: 5 seconds
- Channel prefetch: **1** (each worker processes one message at a time)
- All queues are asserted (created if not exist) on startup

### Queue Names

All queue names are prefixed with the network name:

```
{NETWORK}:{queue_name}
```

Examples for `polkadot`:
```
polkadot:process_blocks
polkadot:process_staking
polkadot:process_nomination_pools
polkadot:process_balances
polkadot:process_metadata
```

| Enum value | Queue name suffix | Producer | Consumer |
|---|---|---|---|
| `QUEUES.Blocks` | `process_blocks` | BlockListener | BlockProcessor |
| `QUEUES.Staking` | `process_staking` | BlockProcessor | PolkadotStakingProcessor |
| `QUEUES.NominationPools` | `process_nomination_pools` | BlockProcessor | NominationPoolsProcessor |
| `QUEUES.Balances` | `process_balances` | BlockProcessor | BalancesProcessor |
| `QUEUES.BlocksMetadata` | `process_metadata` | BlockListener | (metadata processor) |

### Message Format

Every message on every queue has the same structure:

```typescript
{
  entity_id: number,    // block_id or era_id depending on queue
  collect_uid: string,  // UUID, unique per task; used for idempotency
}
```

### Message Processing Protocol

Before any processor acts on a message, `rabbitmq.ts` runs a standard pre-processing wrapper:

1. Increment `attempts` counter for the task in DB
2. Lock the task row in `processing_tasks` (SELECT FOR UPDATE via Knex transaction)
3. Check that task status is `NOT_PROCESSED` — if already processed, skip
4. Call the processor's `processTaskMessage(trx, taskRecord)`
5. On success: `SET status = PROCESSED`, commit transaction
6. On failure: rollback transaction (message is still acked — no infinite loop)
7. After commit: run optional `callback` (used by BlockProcessor to send downstream tasks to RabbitMQ)

---

## 4. Shared Database Layer

### Task Table: `processing_tasks`

Central coordination table. Every unit of work is a row here.

| Column | Type | Description |
|---|---|---|
| `entity` | enum | BLOCK, ERA, NOMINATION_POOLS_ERA, BLOCK_BALANCE, ROUND, IDENTITY_EVENT, etc. |
| `entity_id` | int | block_id or era_id |
| `status` | enum | NOT_PROCESSED → PROCESSING → PROCESSED / CANCELLED |
| `collect_uid` | uuid | Unique per task, used to correlate DB row with RabbitMQ message |
| `attempts` | int | Retry counter |
| `data` | jsonb | For ERA/NOMINATION_POOLS_ERA tasks: contains `payout_block_id` |
| `start_timestamp` | timestamp | When task was created |
| `finish_timestamp` | timestamp | When task completed |

### Task Status: `processing_status`

Tracks the last successfully processed `entity_id` per entity type. Used by BlockListener on startup to know where to resume.

---

## 5. Module Details

### 5.1 BlockListener

**Mode:** `LISTENER`
**Source file:** `src/modules/BlockListener/service.ts`

**Responsibilities:**
- Subscribes to finalized block headers via Polkadot WebSocket RPC (`api.rpc.chain.subscribeFinalizedHeads`)
- On startup: reads last processed block from `processing_status`, loads all unprocessed blocks since then
- Creates `BLOCK` tasks in `processing_tasks` and sends them to `process_blocks` queue
- Also handles recovery: restarts tasks with `attempts < 10` that are stuck in `NOT_PROCESSED` state

**Key behaviors:**
- Batch inserts tasks in configurable chunk sizes (`BATCH_INSERT_CHUNK_SIZE`)
- Each task gets a unique `collect_uid` (UUID v4)
- Supports graceful shutdown (waits for in-flight messages to complete)
- Also creates `BLOCK_METADATA` tasks (for a separate metadata processor)
- Restarts unprocessed `BLOCK_BALANCE` tasks periodically

**Polkadot API usage:**
- `api.rpc.chain.subscribeFinalizedHeads` — live block discovery
- `api.rpc.chain.getBlockHash(height)` — block hash by height

---

### 5.2 BlockProcessor

**Mode:** `BLOCK_PROCESSOR`
**Source file:** `src/modules/BlockProcessor/service.ts`
**Consumes:** `process_blocks`

**Responsibilities:**
- Fetches full block data from Polkadot RPC at the given block hash
- Decodes extrinsics (including nested `utility.batch`, `multisig.asMulti`, `proxy.proxy`)
- Extracts and stores events, links events to extrinsics by phase index
- Detects staking / nomination pools / round events and creates downstream tasks
- Saves new account addresses (transaction signers) to `accounts` table

**Block data fetched (in parallel):**
```
historicalApi.queryMulti([
  timestamp.now,
  system.events,
  balances.totalIssuance,
])
+ rpc.chain.getBlock(blockHash)
+ derive.chain.getHeader(blockHash)
+ system.lastRuntimeUpgrade  (for block metadata)
```

**Also reads from chain metadata** (`BlockProcessorPolkadotHelper.getMetadata`):
- `staking.currentEra`, `staking.activeEra` (polkadot/kusama)
- `session.currentIndex` (polkadot/kusama)
- `parachainStaking.round` (moonbeam/moonriver)

**Downstream task creation (after block is saved):**

| Trigger event | Task created | Queue |
|---|---|---|
| `staking.EraPayout` or `staking.EraPaid` | `ENTITY.ERA` with `payout_block_id` | `process_staking` |
| `nominationPools.*` (polkadot/kusama/assethub/avail) | `ENTITY.NOMINATION_POOLS_ERA` with `payout_block_id` | `process_nomination_pools` |
| Any block on polkadot/kusama | `ENTITY.BLOCK_BALANCE` | `process_balances` |
| `parachainStaking.NewRound` (moonbeam/moonriver) | `ENTITY.ROUND` | `process_staking` |

**Downstream tasks are sent to RabbitMQ only after the block DB transaction is committed** (via `callback` mechanism in the RabbitMQ wrapper).

**Database writes:**
- `blocks` — hash, author, state_root, extrinsics_root, parent_hash, digest, block_time, metadata (era_id, session_id, runtime)
- `extrinsics` — block_id, section, method, signer, success, tip, nonce, full data
- `events` — block_id, section, method, full data
- `total_issuance` — block_id, issuance
- `accounts` — new signers (if not already present)

---

### 5.3 PolkadotStakingProcessor

**Mode:** `STAKING_PROCESSOR`
**Source file:** `src/modules/PolkadotStakingProcessor/service.ts`
**Consumes:** `process_staking`
**Supported networks:** `polkadot`, `kusama`, `polkadot-assethub`, `kusama-assethub`, `vara`, `avail`, `bittensor`

**Responsibilities:**

Each task carries an `era_id` (from the EraPaid event) and `payout_block_id`. The processor runs two sub-tasks in one pass:

**Sub-task A — Stake snapshot for era+1** (next era, which starts at this payout block):
1. Fetch `staking.erasStakers` data at `eraStartBlockHash`
2. Collect all validators for the era and their nominators
3. Validators are processed in parallel with concurrency=5 (using `better-queue`)
4. Save: `stake_eras`, `stake_validators`, `stake_nominators`

**Sub-task B — Reward data for current era** (era_id):
1. Find `start_block_id` for this era from `stake_eras` table
2. At `payout_block_hash`: fetch `staking.erasRewardPoints`, `staking.erasValidatorReward`
3. For each validator: fetch `staking.erasValidatorPrefs`, `staking.payee`
4. Save: `rewards_eras`, `rewards_validators`, `rewards_nominators`

**Runtime version branching** (critical for correctness):

```typescript
const runtime = await apiAtBlock.query.system.lastRuntimeUpgrade()
const specVersion = runtime.unwrap().specVersion.toNumber()

if (specVersion >= 1002000 || (NETWORK === 'vara' && specVersion >= 1500) || NETWORK === 'avail') {
  // New paged API (post-1002000):
  // - erasStakersOverview(era, validator) → total, own, pageCount
  // - erasStakersPaged(era, validator, page) → others[]
} else {
  // Old API (pre-1002000):
  // - erasStakers(era, validator) → total, own, others[]
}
```

**Database writes:**
- `stake_eras` — era_id, session_start, start_block_id, start_block_time, total_stake
- `stake_validators` — era_id, account_id, total, own, nominators_count, prefs
- `stake_nominators` — era_id, account_id, validator, is_clipped, total
- `rewards_eras` — era_id, payout_block_id, total_reward, total_reward_points
- `rewards_validators` — era_id, account_id, reward_points, reward_dest, reward_account_id
- `rewards_nominators` — era_id, account_id, validator, is_clipped, reward_dest, reward_account_id

---

### 5.4 NominationPoolsProcessor

**Mode:** `STAKING_PROCESSOR` (runs alongside PolkadotStakingProcessor)
**Source file:** `src/modules/NominationPoolsProcessor/service.ts`
**Consumes:** `process_nomination_pools`
**Supported networks:** `polkadot`, `kusama`, `polkadot-assethub`, `kusama-assethub`, `avail`, `bittensor`

**Responsibilities:**
- Collects a full snapshot of all nomination pools and their members for each era

**Processing flow:**

1. Receive task with `era_id` and `payout_block_id`
2. **Wait ~10 minutes** (`6 * 200 * 1000 ms`) — this delay is intentional; on-chain pool reward calculations need time to finalize after the payout block
3. Determine two block hashes:
   - `payout_block_hash` — the block at which EraPaid fired
   - `pending_block_hash` = `payout_block_id + 100` — used to read pending rewards
4. Fetch all pools: `nominationPools.bondedPools.entries()`
5. For each pool:
   - Read pool metadata (`nominationPools.metadata`)
   - Read pool roles (depositor, root, nominator, bouncer)
   - Read reward pool state (`nominationPools.rewardPools`)
   - Read all members: `nominationPools.poolMembers.entries()`
6. For `polkadot`/`kusama`/`polkadot-assethub`/`kusama-assethub`: additionally call `nominationPoolsApi.pendingRewards(account)` at `pending_block_hash` for each member

**Database writes:**
- `nomination_pools_identities` — pool_id, pool_name, depositor_id, root_id, nominator_id, toggler_id, reward_id, stash_id, commission
- `nomination_pools_era` — pool_id, era_id, state, members, points, reward_pool, sub_pool_storage
- `nomination_pools_members` — pool_id, era_id, account_id, points, last_recorded_reward_counter, pending_rewards, unbonding_eras

---

### 5.5 IdentityProcessor

**Mode:** `IDENTITY_PROCESSOR`
**Source files:** `src/modules/IdentityProcessor/listner.ts`, `processor.ts`
**Communication: polls PostgreSQL directly — no RabbitMQ**

**Responsibilities:**
- Reads already-stored `events` and `extrinsics` rows from DB and processes identity-related ones

**Polling model:**
- Every 30 seconds: query `events` table for unprocessed identity events (by `entity_id` cursor in `processing_status`)
- Every 30 seconds: query `extrinsics` table for unprocessed identity extrinsics
- Processes in batches with 1-second delay between batches

**Event handlers** (`system` pallet):

| Event | Action |
|---|---|
| `NewAccount` | Create/update `accounts` row with `created_at_block_id` |
| `KilledAccount` | Update `accounts` row with `killed_at_block_id` |
| `JudgementRequested` | Update `accounts` with `judgement_status = REQUESTED` |
| `JudgementGiven` | Update `accounts` with `judgement_status = GIVEN`, `registrar_index` |
| `JudgementUnrequested` | Update `accounts` with `judgement_status = UNREQUESTED` |

**Extrinsic handlers** (`identity` pallet):

| Extrinsic | Action |
|---|---|
| `setIdentity` / `setFields` | Parse and save display, legal, web, riot, email, twitter to `identities` |
| `addSub` | Save sub-account with parent relationship |
| `setSubs` | Batch set sub-accounts |
| `removeSub` | Remove parent-child relationship |
| `quitSub` | Sub-account detaches from parent |

**Identity field parsing:**
- Fields are stored on-chain as `{Raw: "0x..."}` hex strings
- Processor decodes hex → UTF-8 string before saving

**Database writes:**
- `accounts` — account_id, blake2_hash, created_at_block_id, killed_at_block_id, judgement_status, registrar_index
- `identities` — account_id, parent_account_id, display, legal, web, riot, email, twitter, updated_at_block_id

---

### 5.6 BalancesProcessor

**Mode:** `BALANCES_PROCESSOR`
**Source file:** `src/modules/BalancesProcessor/processor.ts`
**Consumes:** `process_balances`
**Active for:** `polkadot`, `kusama` (and other configured networks)

**Responsibilities:**
- Captures all account balance changes at each block using RPC state trace

**How it works:**
```
api.rpc.state.traceBlock(blockHash, targets: System::Account storage key)
```
Returns all storage reads/writes for `System::Account` during that block. Each write represents an account balance change.

**Database writes:**
- `balances` — block_id, account_id, blake2_hash, nonce, consumers, providers, sufficients, free, reserved, miscFrozen, feeFrozen

Note: `blake2_hash` (storage key hash) is the primary lookup key; `account_id` is decoded separately.

---

## 6. Dependency Injection & Initialization

The application uses **TypeDI** for dependency injection. Initialization order (`src/loaders/index.ts`):

```
1. Logger (Pino)
2. PostgreSQL (Knex) → registered as 'knex'
3. RabbitMQ → registered as 'rabbitMQ'
4. SliMetrics → registered as 'sliMetrics'
5. PolkadotAPI → registered as 'polkadotApi'
6. AssetHubAPI (if configured) → registered as 'assetHubApi'
7. Express HTTP server
8. ModulesLoader → starts processors based on MODE
```

All services use `@Inject('knex')`, `@Inject('polkadotApi')`, etc. to receive these shared instances.

---

## 7. Complete Data Flow (Polkadot/Kusama Staking)

```
BlockListener
  │  subscribes to api.rpc.chain.subscribeFinalizedHeads
  │  creates BLOCK tasks in processing_tasks (status=NOT_PROCESSED)
  └─► sends {entity_id: blockId, collect_uid} to polkadot:process_blocks

BlockProcessor
  │  consumes polkadot:process_blocks
  │  fetchs block data from RPC (block + events + extrinsics + totalIssuance)
  │  saves to DB: blocks, extrinsics, events, total_issuance, accounts
  │  scans events for staking.EraPaid
  │  creates ERA task in processing_tasks (with data.payout_block_id)
  │  [after DB commit callback]:
  └─► sends {entity_id: eraId, collect_uid} to polkadot:process_staking
  └─► sends {entity_id: eraId, collect_uid} to polkadot:process_nomination_pools
  └─► sends {entity_id: blockId, collect_uid} to polkadot:process_balances

PolkadotStakingProcessor
  │  consumes polkadot:process_staking
  │  reads payout_block_id from task.data
  │  fetches stakers at eraStartBlock for era+1 (validators + nominators)
  │  fetches reward points + payouts at payout_block for era
  └─► saves: stake_eras, stake_validators, stake_nominators,
             rewards_eras, rewards_validators, rewards_nominators

NominationPoolsProcessor
  │  consumes polkadot:process_nomination_pools
  │  waits 10 minutes
  │  fetches all pools + members at payout_block_hash
  │  fetches pending rewards at payout_block+100 hash
  └─► saves: nomination_pools_identities, nomination_pools_era, nomination_pools_members

BalancesProcessor
  │  consumes polkadot:process_balances
  │  calls state.traceBlock for System::Account storage key
  └─► saves: balances

IdentityProcessor (runs independently, polls DB)
  │  polls events table every 30s → processes NewAccount, KilledAccount, Judgement*
  │  polls extrinsics table every 30s → processes setIdentity, addSub, setSubs, etc.
  └─► saves: accounts, identities
```

---

## 8. Database Tables Reference

### Coordination
| Table | Purpose |
|---|---|
| `processing_tasks` | Task queue; every unit of work is a row |
| `processing_status` | Cursor tracking last processed entity_id per entity type |

### Raw Block Data
| Table | Key columns |
|---|---|
| `blocks` | block_id, hash, author, parent_hash, state_root, block_time, metadata (era_id, session_id, runtime specVersion) |
| `extrinsics` | extrinsic_id, block_id, section, method, signer, success, tip, nonce |
| `events` | event_id, block_id, section, method, data |
| `total_issuance` | block_id, issuance |

### Staking
| Table | Key columns |
|---|---|
| `stake_eras` | era_id, session_start, start_block_id, start_block_time, total_stake |
| `stake_validators` | era_id, account_id, total, own, nominators_count, prefs |
| `stake_nominators` | era_id, account_id, validator, is_clipped, total |
| `rewards_eras` | era_id, payout_block_id, total_reward, total_reward_points |
| `rewards_validators` | era_id, account_id, reward_points, reward_dest, reward_account_id |
| `rewards_nominators` | era_id, account_id, validator, is_clipped, reward_dest, reward_account_id |

### Nomination Pools
| Table | Key columns |
|---|---|
| `nomination_pools_identities` | pool_id, pool_name, depositor_id, root_id, nominator_id, toggler_id, reward_id, stash_id, commission |
| `nomination_pools_era` | pool_id, era_id, state, members, points, reward_pool, sub_pool_storage |
| `nomination_pools_members` | pool_id, era_id, account_id, points, last_recorded_reward_counter, pending_rewards, unbonding_eras |

### Identities & Accounts
| Table | Key columns |
|---|---|
| `accounts` | account_id, blake2_hash, created_at_block_id, killed_at_block_id, judgement_status, registrar_index |
| `identities` | account_id, parent_account_id, display, legal, web, riot, email, twitter, updated_at_block_id |

### Balances
| Table | Key columns |
|---|---|
| `balances` | block_id, account_id, blake2_hash, nonce, free, reserved, miscFrozen, feeFrozen, consumers, providers, sufficients |

---

## 9. Key Implementation Notes

1. **Idempotency** — every task has a `collect_uid` (UUID). The RabbitMQ wrapper locks the DB row and checks `status = NOT_PROCESSED` before processing, making retries safe.

2. **No infinite loops on failure** — failed messages are acked (not nacked/requeued). Retry logic lives in BlockListener's `restartUnprocessedTasks()` which respects `attempts < 10`.

3. **Runtime version branching** — `PolkadotStakingProcessor` checks `specVersion` at the payout block to choose between the old single-call `erasStakers` API and the new paged `erasStakersOverview` + `erasStakersPaged` API (changed in Polkadot runtime 1002000).

4. **NominationPools 10-minute delay** — intentional wait to ensure on-chain pool reward counters are updated before snapshot is taken.

5. **Downstream tasks sent after commit** — `BlockProcessor` creates ERA/pool/balance tasks in DB within the block's transaction, but only sends them to RabbitMQ in a `callback` that runs after the transaction commits. This prevents tasks from being consumed before their data is committed.

6. **Staking concurrency** — validators within an era are fetched in parallel with concurrency=5 using `better-queue`.

7. **IdentityProcessor is pull-based** — it does not use RabbitMQ. It continuously polls the already-saved `events` and `extrinsics` tables, making it decoupled from block processing speed and safe to run behind.

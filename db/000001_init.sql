
CREATE TABLE blocks (
    "network_id" INT,
    "id" BIGINT,
    "hash" VARCHAR(66),
    "state_root" VARCHAR(66),
    "extrinsics_root" VARCHAR(66),
    "parent_hash" VARCHAR(66),
    "author" VARCHAR(66),
    "digest" JSONB,
    "metadata" JSONB,
    "block_time" TIMESTAMP,
    "row_id" SERIAL,
    PRIMARY KEY ("row_id")
);

CREATE TABLE events (
    "network_id" INT,
    "id" VARCHAR(150),
    "block_id" BIGINT NOT NULL,
    "section" VARCHAR(50),
    "method" VARCHAR(50),
    "event" JSONB,
    "row_id" SERIAL,
    PRIMARY KEY ("row_id")
);

CREATE TABLE extrinsics (
    "network_id" INT,
    "id" VARCHAR(150),
    "block_id" BIGINT NOT NULL,
    "success" BOOL,
    "parent_id" VARCHAR(150),
    "section" VARCHAR(50),
    "method" VARCHAR(50),
    "mortal_period" INT,
    "mortal_phase" INT,
    "is_signed" BOOL,
    "signer" VARCHAR(66),
    "tip" BIGINT,
    "nonce" DOUBLE PRECISION,
    "ref_event_ids" VARCHAR(150)[],
    "version" INT,
    "extrinsic" JSONB,
    "row_id" SERIAL,
    PRIMARY KEY ("row_id")
);

CREATE TABLE eras (
    "network_id" INT,
    "era" INT,
    "payout_block_id" INT,
    "session_start" INT,
    "total_reward" BIGINT,
    "total_stake" BIGINT,
    "total_reward_points" INT,
    "row_id" SERIAL,
    PRIMARY KEY ("row_id")
);

CREATE TABLE validators (
    "network_id" INT,
    "era" INT,
    "account_id" VARCHAR(150),
    "active" BOOL,
    "total" BIGINT,
    "own" BIGINT,
    "nominators_count" INT,
    "reward_points" INT,
    "reward_dest" VARCHAR (50),
    "reward_account_id" VARCHAR (150),
    "prefs" JSONB,
    "block_time" TIMESTAMP,
    "row_id" SERIAL,
    PRIMARY KEY ("row_id")
);

CREATE TABLE nominators (
    "network_id" INT,
    "era" INT,
    "account_id" VARCHAR(150),
    "validator" VARCHAR (150),
    "is_clipped" BOOL,
    "value" BIGINT,
    "reward_dest" VARCHAR (50),
    "reward_account_id" VARCHAR (150),
    "block_time" TIMESTAMP,
    "row_id" SERIAL,
    PRIMARY KEY ("row_id")
);

CREATE TYPE processing_status AS ENUM ('not_processed', 'processed', 'cancelled');

CREATE TABLE processing_tasks (
    "network_id" INT,
    "entity" VARCHAR (50),
    "entity_id" INT,
    "status" processing_status,
    "collect_uid" UUID,
    "start_timestamp" TIMESTAMP,
    "finish_timestamp" TIMESTAMP,
    "data" JSONB,
    "attempts" INT,
    "row_id" SERIAL,
    PRIMARY KEY ("row_id")
);

CREATE TABLE processing_state (
    "network_id" INT,
    "entity" VARCHAR (50),
    "entity_id" INT,
    "row_id" SERIAL,
    PRIMARY KEY ("row_id")
);
ALTER TABLE IF EXISTS public.processing_state ADD CONSTRAINT processing_state_uniq_key UNIQUE (entity, network_id);

CREATE INDEX processing_tasks_base_idx ON processing_tasks (entity, entity_id, network_id); 

CREATE TABLE rounds (
    "network_id" INT,
    "round_id" INT,
    "total_stake" VARCHAR(50),
    "total_reward_points" INT,
    "total_reward" VARCHAR(50),
    "collators_count" INT,
    "start_block_id" INT,
    "start_block_time" TIMESTAMP,
    "payout_block_id" INT,
    "payout_block_time" TIMESTAMP,
    "runtime" INT,
    "row_id" SERIAL,
    PRIMARY KEY ("row_id")
);

CREATE TABLE collators (
    "network_id" INT,
    "round_id" INT,
    "account_id" VARCHAR(150),
    "total_stake" VARCHAR(50),
    "own_stake" VARCHAR(50),
    "delegators_count" INT,
    "total_reward_points" INT,
    "total_reward" VARCHAR (50),
    "collator_reward" VARCHAR (50),
    "payout_block_id" INT,
    "payout_block_time" TIMESTAMP,
    "row_id" SERIAL,
    PRIMARY KEY ("row_id")
);

CREATE TABLE delegators (
    "network_id" INT,
    "round_id" INT,
    "account_id" VARCHAR(150),
    "collator_id" VARCHAR (150),
    "amount" VARCHAR(50),
    "final_amount" VARCHAR(50),
    "reward" VARCHAR (50),
    "payout_block_id" INT,
    "payout_block_time" TIMESTAMP,
    "row_id" SERIAL,
    PRIMARY KEY ("row_id")
);

CREATE TABLE networks (
    "network_id" INT,
    "name" VARCHAR(50),
    "decimals" INT

)


alter table blocks add column metadata JSONB;
alter table rounds add column runtime INT;

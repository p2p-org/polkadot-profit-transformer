
CREATE TABLE IF NOT EXISTS blocks (
    "network_id" INT,
    "block_id" BIGINT,
    "hash" VARCHAR(66),
    "state_root" VARCHAR(66),
    "extrinsics_root" VARCHAR(66),
    "parent_hash" VARCHAR(66),
    "author" VARCHAR(66),
    "digest" JSONB,
    "metadata" JSONB,
    "block_time" TIMESTAMP,
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);

CREATE TABLE IF NOT EXISTS events (
    "network_id" INT,
    "event_id" VARCHAR(150),
    "block_id" BIGINT NOT NULL,
    "section" VARCHAR(50),
    "method" VARCHAR(50),
    "event" JSONB,
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);

CREATE TABLE IF NOT EXISTS extrinsics (
    "network_id" INT,
    "extrinsic_id" VARCHAR(150),
    "block_id" BIGINT NOT NULL,
    "success" BOOL,
    "parent_id" VARCHAR(150),
    "section" VARCHAR(50),
    "method" VARCHAR(50),
    "mortal_period" INT,
    "mortal_phase" INT,
    "is_signed" BOOL,
    "signer" VARCHAR(66),
    "tip" numeric(30),
    "nonce" DOUBLE PRECISION,
    "ref_event_ids" VARCHAR(150)[],
    "version" INT,
    "extrinsic" JSONB,
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);

CREATE TABLE IF NOT EXISTS eras (
    "network_id" INT,
    "era_id" INT,
    "payout_block_id" INT,
    "session_start" INT,
    "total_reward" BIGINT,
    "total_stake" BIGINT,
    "total_reward_points" INT,
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);

CREATE TABLE IF NOT EXISTS validators (
    "network_id" INT,
    "era_id" INT,
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
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);

CREATE TABLE IF NOT EXISTS nominators (
    "network_id" INT,
    "era_id" INT,
    "account_id" VARCHAR(150),
    "validator" VARCHAR (150),
    "is_clipped" BOOL,
    "value" BIGINT,
    "reward_dest" VARCHAR (50),
    "reward_account_id" VARCHAR (150),
    "block_time" TIMESTAMP,
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);

CREATE TYPE processing_status AS ENUM ('not_processed', 'processing', 'processed', 'cancelled');

CREATE TABLE IF NOT EXISTS processing_tasks (
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
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);
CREATE INDEX processing_tasks_entity_idx ON public.processing_tasks USING btree (entity, entity_id, network_id);

CREATE TABLE IF NOT EXISTS processing_state (
    "network_id" INT,
    "entity" VARCHAR (50),
    "entity_id" INT,
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);
ALTER TABLE IF EXISTS public.processing_state ADD CONSTRAINT processing_state_uniq_key UNIQUE (entity, network_id);

CREATE INDEX processing_tasks_base_idx ON processing_tasks (entity, entity_id, network_id); 

CREATE TABLE IF NOT EXISTS rounds (
    "network_id" INT,
    "round_id" INT,
    "total_stake" NUMERIC(35),
    "total_reward_points" INT,
    "total_reward" NUMERIC(35),
    "collators_count" INT,
    "start_block_id" INT,
    "start_block_time" TIMESTAMP,
    "payout_block_id" INT,
    "payout_block_time" TIMESTAMP,
    "runtime" INT,
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);

CREATE TABLE IF NOT EXISTS collators (
    "network_id" INT,
    "round_id" INT,
    "account_id" VARCHAR(150),
    "active" BOOL,
    "total_stake" NUMERIC(35),
    "final_stake" NUMERIC(35),
    "own_stake" NUMERIC(35),
    "delegators_count" INT,
    "total_reward_points" INT,
    "total_reward" NUMERIC(35),
    "collator_reward" NUMERIC(35),
    "payout_block_id" INT,
    "payout_block_time" TIMESTAMP,
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);

CREATE TABLE IF NOT EXISTS delegators (
    "network_id" INT,
    "round_id" INT,
    "account_id" VARCHAR(150),
    "collator_id" VARCHAR (150),
    "amount" NUMERIC(35),
    "final_amount" NUMERIC(35),
    "reward" NUMERIC(35),
    "payout_block_id" INT,
    "payout_block_time" TIMESTAMP,
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);

CREATE TABLE IF NOT EXISTS networks (
    "network_id" INT,
    "name" VARCHAR (50),
    "decimals" INT
);

CREATE TABLE IF NOT EXISTS accounts (
        "network_id" INT,
        "account_id" varchar(50),
        "blake2_hash" varchar(100),
        "created_at_block_id" BIGINT,
        "killed_at_block_id" BIGINT,
        "judgement_status" varchar(256),
        "registrar_index" BIGINT,
        "row_id" SERIAL,
        "row_time" TIMESTAMP,
        PRIMARY KEY ("row_id"),
        UNIQUE ("account_id", "network_id"),
        UNIQUE ("blake2_hash", "network_id")
);
CREATE INDEX accounts_blake2_hash_idx ON public.accounts (blake2_hash, network_id);



CREATE TABLE IF NOT EXISTS balances (
    "network_id" INT,
    "block_id" BIGINT,
    "account_id" varchar(50),
    "blake2_hash" varchar(100),
    "nonce" INT,
    "consumers" INT,
    "providers" INT,
    "sufficients" INT,
    "free" NUMERIC(50),
    "reserved" NUMERIC(50),
    "miscFrozen" NUMERIC(50),
    "feeFrozen" NUMERIC(50),
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id"),
    UNIQUE ("network_id", "blake2_hash", "block_id")
);

CREATE TABLE IF NOT EXISTS identities (
    "network_id" INT,
    "account_id" varchar(150),
    "parent_account_id" varchar(150),
    "display" varchar(256),
    "legal" varchar(256),
    "web" varchar(256),
    "riot" varchar(256),
    "email" varchar(256),
    "twitter" varchar(256),
    "updated_at_block_id" BIGINT,
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id"),
    UNIQUE ("account_id", "network_id")
);


CREATE TABLE IF NOT EXISTS gear_smartcontracts (
    "network_id" INT,
    "block_id" BIGINT,
    "extrinsic_id" VARCHAR(150),
    "account_id" VARCHAR(50),
    "program_id" VARCHAR(100),
    "expiration" VARCHAR(20),
    "gas_limit" VARCHAR(20),
    "init_payload" TEXT,
    "init_payload_decoded" JSONB,
    "code" TEXT,
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id"),
    UNIQUE ("program_id", "network_id")
);

CREATE TABLE IF NOT EXISTS gear_smartcontracts_messages (
    "network_id" INT,
    "block_id" BIGINT,
    "extrinsic_id" VARCHAR(150),
    "account_id" VARCHAR(50),
    "program_id" VARCHAR(100),
    "gas_limit" VARCHAR(20),
    "payload" TEXT,
    "payload_decoded" JSONB,
    "value" TEXT,
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    UNIQUE ("extrinsic_id", "network_id"),
    PRIMARY KEY ("row_id")
);


CREATE TABLE IF NOT EXISTS sli_metrics (
    "network_id" INT,
    "entity" VARCHAR(66),
    "entity_id" BIGINT,
    "name" VARCHAR(40),
    "value" BIGINT,
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);


CREATE TABLE IF NOT EXISTS total_issuance (
    "network_id" INT,
    "block_id" BIGINT,
    "total_issuance" NUMERIC(40),
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);
CREATE UNIQUE INDEX total_issuance_network_id_idx ON public.total_issuance (network_id,block_id);


CREATE TABLE IF NOT EXISTS stake_eras (
    "network_id" INT,
    "era_id" INT,
    "start_block_id" INT,
    "start_block_time" TIMESTAMP,
    "session_start" INT,
    "total_stake"  numeric(35),
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);

CREATE TABLE IF NOT EXISTS stake_validators (
    "network_id" INT,
    "era_id" INT,
    "account_id" VARCHAR(150),
    "active" BOOL,
    "total" numeric(35),
    "own" numeric(35),
    "nominators_count" INT,
    "prefs" JSONB,
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);

CREATE TABLE IF NOT EXISTS stake_nominators (
    "network_id" INT,
    "era_id" INT,
    "account_id" VARCHAR(150),
    "validator" VARCHAR (150),
    "is_clipped" BOOL,
    "value" numeric(35),
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);

CREATE TABLE IF NOT EXISTS rewards_eras (
    "network_id" INT,
    "era_id" INT,
    "payout_block_id" INT,
    "total_reward" BIGINT,
    "total_reward_points" INT,
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);

CREATE TABLE IF NOT EXISTS rewards_validators (
    "network_id" INT,
    "era_id" INT,
    "account_id" VARCHAR(150),
    "active" BOOL,
    "nominators_count" INT,
    "reward_points" INT,
    "reward_dest" VARCHAR (150),
    "reward_account_id" VARCHAR (150),
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);

CREATE TABLE IF NOT EXISTS rewards_nominators (
    "network_id" INT,
    "era_id" INT,
    "account_id" VARCHAR(150),
    "validator" VARCHAR (150),
    "is_clipped" BOOL,
    "reward_dest" VARCHAR (150),
    "reward_account_id" VARCHAR (150),
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);



CREATE TABLE IF NOT EXISTS stake_rounds (
    "network_id" INT,
    "round_id" INT,
    "total_stake" NUMERIC(35),
    "collators_count" INT,
    "start_block_id" INT,
    "start_block_time" TIMESTAMP,
    "runtime" INT,
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);

CREATE TABLE  IF NOT EXISTS stake_collators (
    "network_id" INT,
    "round_id" INT,
    "account_id" VARCHAR(150),
    "active" BOOL,
    "total_stake" NUMERIC(35),
    "own_stake" NUMERIC(35),
    "delegators_count" INT,
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);

CREATE TABLE IF NOT EXISTS stake_delegators (
    "network_id" INT,
    "round_id" INT,
    "account_id" VARCHAR(150),
    "collator_id" VARCHAR (150),
    "amount" NUMERIC(35),
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);

CREATE TABLE IF NOT EXISTS rewards_rounds (
    "network_id" INT,
    "round_id" INT,
    "total_reward_points" INT,
    "total_reward" NUMERIC(35),
    "payout_block_id" INT,
    "payout_block_time" TIMESTAMP,
    "runtime" INT,
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);

CREATE TABLE IF NOT EXISTS rewards_collators (
    "network_id" INT,
    "round_id" INT,
    "account_id" VARCHAR(150),
    "active" BOOL,
    "final_stake" NUMERIC(35),
    "total_reward_points" INT,
    "total_reward" NUMERIC(35),
    "collator_reward" NUMERIC(35),
    "payout_block_id" INT,
    "payout_block_time" TIMESTAMP,
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);

CREATE TABLE IF NOT EXISTS rewards_delegators (
    "network_id" INT,
    "round_id" INT,
    "account_id" VARCHAR(150),
    "collator_id" VARCHAR (150),
    "final_amount" NUMERIC(35),
    "reward" NUMERIC(35),
    "payout_block_id" INT,
    "payout_block_time" TIMESTAMP,
    "row_id" SERIAL,
    "row_time" TIMESTAMP,
    PRIMARY KEY ("row_id")
);


CREATE INDEX identity_parent_idx ON public.identities ("parent_account_id", "network_id");

create index events_block_id_idx on events (block_id);
create index rounds_round_id_idx on rounds (round_id);
create index collators_round_id_idx on collators (round_id);
create index deleagators_round_id_idx on delegators (round_id);

create index eras_era_id_idx on eras (era_id);
create index validators_era_id_idx on validators (era_id);
create index nominators_era_id_idx on nominators (era_id);


CREATE INDEX blocks_block_id_idx ON public.blocks (block_id);

CREATE INDEX extrinsics_signer_idx ON public.extrinsics (signer);
--new. need to produce evrywhere
CREATE INDEX extrinsics_section_idx ON public.extrinsics ("section","method");
CREATE INDEX events_section_idx ON public.events ("section","method");

INSERT INTO networks VALUES(0, 'polkadot', 10);
INSERT INTO networks VALUES(2, 'Kusama', 12);
INSERT INTO networks VALUES(1284, 'Moonbeam', 18);
INSERT INTO networks VALUES(1285, 'Moonriver', 18);


CREATE INDEX idx_signer ON extrinsics("signer");
CREATE INDEX idx_signer_block ON extrinsics ("signer", "block_id");
CREATE INDEX processing_tasks_entity_status_idx ON public.processing_tasks (entity, status);

CREATE INDEX extrinsics_row_time_idx ON public.extrinsics (row_time);

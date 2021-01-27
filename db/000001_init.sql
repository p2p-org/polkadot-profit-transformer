CREATE  SCHEMA IF NOT EXISTS dot_polka;


CREATE TABLE dot_polka._config (
    "key" VARCHAR (100) PRIMARY KEY,
    "value" TEXT
);

CREATE TABLE dot_polka.blocks (
    "id" BIGINT PRIMARY KEY,
    "hash" VARCHAR(66),
    "state_root" VARCHAR(66),
    "extrinsics_root" VARCHAR(66),
    "parent_hash" VARCHAR(66),
    "author" VARCHAR(66),
    "session_id" INT,
    "era" INT,
    "last_log" VARCHAR(100),
    "digest" JSONB,
    "block_time" TIMESTAMP
);

CREATE TABLE dot_polka.events (
    "id" VARCHAR(150) PRIMARY KEY,
    "block_id" BIGINT NOT NULL,
    "session_id" INT,
    "era" INT,
    "section" VARCHAR(50),
    "method" VARCHAR(50),
    "data" JSONB,
    "event" JSONB
);

CREATE TABLE dot_polka.extrinsics (
    "id" VARCHAR(150) PRIMARY KEY,
    "block_id" BIGINT NOT NULL,
    "parent_id" VARCHAR(150),
    "session_id" INT,
    "era" INT,
    "section" VARCHAR(50),
    "method" VARCHAR(50),
    "mortal_period" INT,
    "mortal_phase" INT,
    "is_signed" BOOL,
    "signer" VARCHAR(66),
    "tip" INT,
    "nonce" DOUBLE PRECISION,
    "ref_event_ids" VARCHAR(150)[],
    "version" INT,
    "extrinsic" JSONB,
    "args" JSONB
);


CREATE TABLE dot_polka.eras (
    "era" INT PRIMARY KEY,
    "session_start" INT,
    "validators_active" INT,
    "nominators_active" INT,
    "total_reward" BIGINT,
    "total_stake" BIGINT,
    "total_reward_points" INT
);

CREATE TABLE dot_polka.validators (
    "era" INT,
    "account_id" VARCHAR(150),
    "is_enabled" BOOL,
    "total" BIGINT,
    "own" BIGINT,
    "nominators_count" INT,
    "reward_points" INT,
    "reward_dest" VARCHAR (50),
    "reward_account_id" VARCHAR (150),
    "prefs" JSONB,
    "block_time" TIMESTAMP,
    PRIMARY KEY ("era", "account_id")
);

CREATE TABLE dot_polka.nominators (
    "era" INT,
    "account_id" VARCHAR(150),
    "validator" VARCHAR (150),
    "is_enabled" BOOL,
    "is_clipped" BOOL,
    "value" BIGINT,
    "reward_dest" VARCHAR (50),
    "reward_account_id" VARCHAR (150),
    "block_time" TIMESTAMP,
    PRIMARY KEY ("era", "account_id", "validator")
);


CREATE TABLE dot_polka.account_identity (
    "account_id" varchar(50) PRIMARY KEY,
    "root_account_id" varchar(50),
    "display" varchar(256),
    "legal" varchar(256),
    "web" varchar(256),
    "riot" varchar(256),
    "email" varchar(256),
    "twitter" varchar(256),
    "created_at" BIGINT,
    "killed_at" BIGINT
);

CREATE TABLE dot_polka.balances (
    "block_id" INTEGER NOT NULL,
    "account_id" TEXT,
    "balance" DOUBLE PRECISION,
    "method" VARCHAR(30),
    "is_validator" BOOLEAN,
    "block_time" TIMESTAMP
);

-- Fix for unquoting varchar json
CREATE OR REPLACE FUNCTION varchar_to_jsonb(varchar) RETURNS jsonb AS
$$
SELECT to_jsonb($1)
$$ LANGUAGE SQL;

CREATE CAST (varchar as jsonb) WITH FUNCTION varchar_to_jsonb(varchar) AS IMPLICIT;

-- Internal tables

CREATE TABLE dot_polka._blocks (
    "id" BIGINT PRIMARY KEY,
    "hash" VARCHAR(66),
    "state_root" VARCHAR(66),
    "extrinsics_root" VARCHAR(66),
    "parent_hash" VARCHAR(66),
    "author" VARCHAR(66),
    "session_id" INT,
    "era" INT,
    "last_log" VARCHAR(100),
    "digest" TEXT,
    "block_time" BIGINT
);

CREATE TABLE dot_polka._events (
    "id" VARCHAR(150) PRIMARY KEY,
    "block_id" BIGINT NOT NULL,
    "session_id" INT,
    "era" INT,
    "section" VARCHAR(30),
    "method" VARCHAR(30),
    "data" TEXT,
    "event" TEXT
);

CREATE TABLE dot_polka._extrinsics (
   "id" VARCHAR(150) PRIMARY KEY,
   "block_id" BIGINT NOT NULL,
   "parent_id" VARCHAR(150),
   "session_id" INT,
   "era" INT,
   "section" VARCHAR(50),
   "method" VARCHAR(50),
   "mortal_period" INT,
   "mortal_phase" INT,
   "is_signed" BOOL,
   "signer" VARCHAR(66),
   "tip" INT,
   "nonce" DOUBLE PRECISION,
   "ref_event_ids" TEXT,
   "version" INT,
   "extrinsic" TEXT,
   "args" TEXT
);


CREATE TABLE dot_polka._eras (
    "era" INT PRIMARY KEY ,
    "session_start" INT,
    "validators_active" INT,
    "nominators_active" INT,
    "total_reward" TEXT,
    "total_stake" TEXT,
    "total_reward_points" INT
);

CREATE TABLE dot_polka._validators (
    "era" INT,
    "account_id" VARCHAR(150),
    "is_enabled" BOOL,
    "is_clipped" BOOL,
    "total" TEXT,
    "own" TEXT,
    "reward_points" INT,
    "reward_dest" VARCHAR (50),
    "reward_account_id" VARCHAR (150),
    "nominators_count" INT,
    "prefs" TEXT,
    "block_time" BIGINT
);

CREATE TABLE dot_polka._nominators (
    "era" INT,
    "account_id" VARCHAR(150),
    "validator" VARCHAR (150),
    "is_enabled" BOOL,
    "is_clipped" BOOL,
    "value" TEXT,
    "reward_dest" VARCHAR (50),
    "reward_account_id" VARCHAR (150),
    "block_time" BIGINT
);

CREATE TABLE dot_polka._balances (
    "block_id" INTEGER NOT NULL,
    "account_id" TEXT,
    "balance" DOUBLE PRECISION,
    "method" TEXT,
    "is_validator" BOOLEAN,
    "block_time" BIGINT
);

-- Blocks

CREATE OR REPLACE FUNCTION dot_polka.sink_blocks_insert()
    RETURNS trigger AS
$$
BEGIN
    INSERT INTO dot_polka.blocks("id",
                                "hash",
                                "state_root",
                                "extrinsics_root",
                                "parent_hash",
                                "author",
                                "session_id",
                                "era",
                                "last_log",
                                "digest",
                                "block_time")
    VALUES (NEW."id",
            NEW."hash",
            NEW."state_root",
            NEW."extrinsics_root",
            NEW."parent_hash",
            NEW."author",
            NEW."session_id",
            NEW."era",
            NEW."last_log",
            NEW."digest"::jsonb,
            to_timestamp(NEW."block_time"))
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END ;

$$
    LANGUAGE 'plpgsql';

CREATE TRIGGER trg_blocks_sink_upsert
    BEFORE INSERT
    ON dot_polka._blocks
    FOR EACH ROW
EXECUTE PROCEDURE dot_polka.sink_blocks_insert();

CREATE OR REPLACE FUNCTION dot_polka.sink_trim_blocks_after_insert()
    RETURNS trigger AS
$$
BEGIN
    DELETE FROM dot_polka._blocks WHERE "id" = NEW."id";
    RETURN NEW;
END;
$$
    LANGUAGE 'plpgsql';

CREATE TRIGGER trg_blocks_sink_trim_after_upsert
    AFTER INSERT
    ON dot_polka._blocks
    FOR EACH ROW
EXECUTE PROCEDURE dot_polka.sink_trim_blocks_after_insert();

-- Events

CREATE OR REPLACE FUNCTION dot_polka.sink_events_insert()
    RETURNS trigger AS
$$
BEGIN
    INSERT INTO dot_polka.events("id",
                                "block_id",
                                "session_id",
                                "era",
                                "section",
                                "method",
                                "data",
                                "event")
    VALUES (NEW."id",
            NEW."block_id",
            NEW."session_id",
            NEW."era",
            NEW."section",
            NEW."method",
            NEW."data"::jsonb,
            NEW."event"::jsonb)
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END ;

$$
    LANGUAGE 'plpgsql';

CREATE TRIGGER trg_events_sink_upsert
    BEFORE INSERT
    ON dot_polka._events
    FOR EACH ROW
EXECUTE PROCEDURE dot_polka.sink_events_insert();

CREATE OR REPLACE FUNCTION dot_polka.sink_trim_events_after_insert()
    RETURNS trigger AS
$$
BEGIN
    DELETE FROM dot_polka._events WHERE "id" = NEW."id";
    RETURN NEW;
END;
$$
    LANGUAGE 'plpgsql';

CREATE TRIGGER trg_events_sink_trim_after_upsert
    AFTER INSERT
    ON dot_polka._events
    FOR EACH ROW
EXECUTE PROCEDURE dot_polka.sink_trim_events_after_insert();

-- Extrinsics

CREATE OR REPLACE FUNCTION dot_polka.sink_extrinsics_insert()
    RETURNS trigger AS
$$
BEGIN
    INSERT INTO dot_polka.extrinsics("id",
                                "block_id",
                                "parent_id",
                                "session_id",
                                "era",
                                "section",
                                "method",
                                "mortal_period",
                                "mortal_phase",
                                "is_signed",
                                "signer",
                                "tip",
                                "nonce",
                                "ref_event_ids",
                                "version",
                                "extrinsic",
                                "args")
    VALUES (NEW."id",
            NEW."block_id",
            NEW."parent_id",
            NEW."session_id",
            NEW."era",
            NEW."section",
            NEW."method",
            NEW."mortal_period",
            NEW."mortal_phase",
            NEW."is_signed",
            NEW."signer",
            NEW."tip",
            NEW."nonce",
            NEW."ref_event_ids"::VARCHAR(150)[],
            NEW."version",
            NEW."extrinsic"::jsonb,
            NEW."args"::jsonb)
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END ;

$$
    LANGUAGE 'plpgsql';

CREATE TRIGGER trg_extrinsics_sink_upsert
    BEFORE INSERT
    ON dot_polka._extrinsics
    FOR EACH ROW
EXECUTE PROCEDURE dot_polka.sink_extrinsics_insert();

CREATE OR REPLACE FUNCTION dot_polka.sink_trim_extrinsics_after_insert()
    RETURNS trigger AS
$$
BEGIN
    DELETE FROM dot_polka._extrinsics WHERE "id" = NEW."id";
    RETURN NEW;
END;
$$
    LANGUAGE 'plpgsql';

CREATE TRIGGER trg_extrinsics_sink_trim_after_upsert
    AFTER INSERT
    ON dot_polka._extrinsics
    FOR EACH ROW
EXECUTE PROCEDURE dot_polka.sink_trim_extrinsics_after_insert();


CREATE INDEX dot_polka_balances_account_id_method_idx ON dot_polka.balances ("account_id", "method");

CREATE INDEX dot_polka_account_identity_account_id_idx ON dot_polka.account_identity (account_id);

-- Validators


CREATE OR REPLACE FUNCTION dot_polka.sink_validators_insert()
    RETURNS trigger AS
$$
BEGIN
    INSERT INTO dot_polka.validators("era",
                                "account_id",
                                "is_enabled",
                                "total",
                                "own",
                                "reward_points",
                                "reward_dest",
                                "reward_account_id",
                                "nominators_count",
                                "prefs",
                                "block_time")
    VALUES (NEW."era",
            NEW."account_id",
            NEW."is_enabled",
            NEW."total"::BIGINT,
            NEW."own"::BIGINT,
            NEW."reward_points",
            NEW."reward_dest",
            NEW."reward_account_id",
            NEW."nominators_count",
            NEW."prefs"::jsonb,
            to_timestamp(NEW."block_time"))
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END ;

$$
    LANGUAGE 'plpgsql';

CREATE TRIGGER trg_validators_sink_upsert
    BEFORE INSERT
    ON dot_polka._validators
    FOR EACH ROW
EXECUTE PROCEDURE dot_polka.sink_validators_insert();

CREATE OR REPLACE FUNCTION dot_polka.sink_trim_validators_after_insert()
    RETURNS trigger AS
$$
BEGIN
    DELETE FROM dot_polka._validators WHERE "era" = NEW."era"
        AND "account_id" = NEW."account_id";
    RETURN NEW;
END;
$$
    LANGUAGE 'plpgsql';

CREATE TRIGGER trg_validators_sink_trim_after_upsert
    AFTER INSERT
    ON dot_polka._validators
    FOR EACH ROW
EXECUTE PROCEDURE dot_polka.sink_trim_validators_after_insert();


-- Nominators

CREATE OR REPLACE FUNCTION dot_polka.sink_nominators_insert()
    RETURNS trigger AS
$$
BEGIN
    INSERT INTO dot_polka.nominators("era",
                                "account_id",
                                "validator",
                                "is_enabled",
                                "is_clipped",
                                "value",
                                "reward_dest",
                                "reward_account_id",
                                "block_time")
    VALUES (NEW."era",
            NEW."account_id",
            NEW."validator",
            NEW."is_enabled",
            NEW."is_clipped",
            NEW."value"::BIGINT,
            NEW."reward_dest",
            NEW."reward_account_id",
            to_timestamp(NEW."block_time"))
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END ;

$$
    LANGUAGE 'plpgsql';

CREATE TRIGGER trg_nominators_sink_upsert
    BEFORE INSERT
    ON dot_polka._nominators
    FOR EACH ROW
EXECUTE PROCEDURE dot_polka.sink_nominators_insert();

CREATE OR REPLACE FUNCTION dot_polka.sink_trim_nominators_after_insert()
    RETURNS trigger AS
$$
BEGIN
    DELETE FROM dot_polka._nominators WHERE "era" = NEW."era"
        AND "account_id" = NEW."account_id";
    RETURN NEW;
END;
$$
    LANGUAGE 'plpgsql';

CREATE TRIGGER trg_nominators_sink_trim_after_upsert
    AFTER INSERT
    ON dot_polka._nominators
    FOR EACH ROW
EXECUTE PROCEDURE dot_polka.sink_trim_nominators_after_insert();


-- Eras

CREATE OR REPLACE FUNCTION dot_polka.sink_eras_insert()
    RETURNS trigger AS
$$
BEGIN
INSERT INTO dot_polka.eras("era",
                               "session_start",
                               "validators_active",
                               "nominators_active",
                               "total_reward",
                               "total_stake",
                               "total_reward_points"
                               )
VALUES (NEW."era",
        NEW."session_start",
        NEW."validators_active",
        NEW."nominators_active",
        NEW."total_reward"::BIGINT,
        NEW."total_stake"::BIGINT,
        NEW."total_reward_points")
    ON CONFLICT DO NOTHING;

RETURN NEW;
END ;

$$
LANGUAGE 'plpgsql';

CREATE TRIGGER trg_eras_sink_upsert
    BEFORE INSERT
    ON dot_polka._eras
    FOR EACH ROW
    EXECUTE PROCEDURE dot_polka.sink_eras_insert();

CREATE OR REPLACE FUNCTION dot_polka.sink_trim_eras_after_insert()
    RETURNS trigger AS
$$
BEGIN
DELETE FROM dot_polka._eras WHERE "era" = NEW."era";
RETURN NEW;
END;
$$
LANGUAGE 'plpgsql';

CREATE TRIGGER trg_eras_sink_trim_after_upsert
    AFTER INSERT
    ON dot_polka._eras
    FOR EACH ROW
    EXECUTE PROCEDURE dot_polka.sink_trim_eras_after_insert();

-- Account identity

CREATE OR REPLACE FUNCTION dot_polka.sink_account_identity_upsert()
    RETURNS trigger AS
$$
BEGIN

    OLD."killed_at" = NEW."killed_at";

RETURN OLD;
END ;

$$
LANGUAGE 'plpgsql';


CREATE TRIGGER trg_account_identity_upsert
    BEFORE UPDATE
    ON dot_polka.account_identity
    FOR EACH ROW EXECUTE PROCEDURE dot_polka.sink_account_identity_upsert();

--  BI additions

CREATE MATERIALIZED VIEW dot_polka.mv_bi_accounts_balance TABLESPACE pg_default AS
SELECT
           e.session_id,
           e.era,
           ((e.data ->> 0)::jsonb) ->> 'AccountId' AS account_id,
           e.method,
           e.data,
           b.id AS block_id,
           b.block_time
FROM dot_polka.events e
JOIN dot_polka.blocks b ON b.id = e.block_id
WHERE e.section::text = 'balances'::text
ORDER BY e.block_id DESC WITH DATA;

REFRESH MATERIALIZED VIEW dot_polka.mv_bi_accounts_balance;




CREATE MATERIALIZED VIEW dot_polka.mv_bi_accounts_staking AS
SELECT
           e.session_id,
           e.era,
            ((e.data ->> 0)::jsonb) ->> 'AccountId' AS account_id,
           e.method,
           CASE WHEN e.method IN ('Unbonded', 'Slash', 'Withdrawn') THEN (((e.data ->> 1)::jsonb) ->> 'Balance')::DOUBLE PRECISION / 10^10 * -1
                  ELSE (((e.data ->> 1)::jsonb) ->> 'Balance')::DOUBLE PRECISION / 10^10
           END AS balance,
           b.block_time
FROM dot_polka.events e
JOIN dot_polka.blocks b ON b.id = e.block_id
WHERE e.section = 'staking' AND e.method IN ('Bonded', 'Reward', 'Slash', 'Unbonded', 'Withdrawn')
ORDER BY e.block_id DESC WITH DATA;

REFRESH MATERIALIZED VIEW dot_polka.mv_bi_accounts_staking;
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
    "section" VARCHAR(50),
    "method" VARCHAR(50),
    "data" JSONB,
    "event" JSONB
);

CREATE TABLE dot_polka.extrinsics (
    "id" VARCHAR(150) PRIMARY KEY,
    "block_id" BIGINT NOT NULL,
    "section" VARCHAR(50),
    "method" VARCHAR(50),
    "ref_event_ids" VARCHAR(150)[],
    "extrinsic" JSONB
);

CREATE TABLE dot_polka.sessions (
    "session_id" INT PRIMARY KEY ,
    "era" INT,
    "block_end" BIGINT,
    "block_time" TIMESTAMP
);

CREATE TABLE dot_polka.validators (
    "session_id" INT,
    "account_id" VARCHAR(150),
    "era" INT,
    "is_enabled" BOOL,
    "total" BIGINT,
    "own" BIGINT,
    "reward_points" INT,
    "reward_dest" VARCHAR (50),
    "reward_account_id" VARCHAR (150),
    "block_time" TIMESTAMP,
    PRIMARY KEY ("session_id", "account_id")
);

CREATE TABLE dot_polka.nominators (
    "account_id" VARCHAR(150) PRIMARY KEY,
    "session_id" INT,
    "era" INT,
    "validator" VARCHAR (150),
    "is_enabled" BOOL,
    "value" BIGINT,
    "reward_dest" VARCHAR (50),
    "reward_account_id" VARCHAR (150),
    "block_time" TIMESTAMP
);


CREATE TABLE dot_polka.account_identity (
    "account_id" varchar(50) PRIMARY KEY,
    "display" varchar(256),
    "legal" varchar(256),
    "web" varchar(256),
    "riot" varchar(256),
    "email" varchar(256),
    "twitter" varchar(256)
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
    "section" VARCHAR(30),
    "method" VARCHAR(30),
    "data" TEXT,
    "event" TEXT
);

CREATE TABLE dot_polka._extrinsics (
    "id" VARCHAR(150) PRIMARY KEY,
    "block_id" BIGINT NOT NULL,
    "section" VARCHAR(50),
    "method" VARCHAR(50),
    "ref_event_ids" TEXT,
    "extrinsic" TEXT
);

CREATE TABLE dot_polka._validators (
    "session_id" INT,
    "account_id" VARCHAR(150),
    "era" INT,
    "is_enabled" BOOL,
    "total" TEXT,
    "own" TEXT,
    "reward_points" INT,
    "reward_dest" VARCHAR (50),
    "reward_account_id" VARCHAR (150),
    "block_time" BIGINT,
    PRIMARY KEY ("session_id", "account_id")
);

CREATE TABLE dot_polka._nominators (
    "session_id" INT,
    "account_id" VARCHAR(150),
    "era" INT,
    "validator" VARCHAR (150),
    "is_enabled" BOOL,
    "value" TEXT,
    "reward_dest" VARCHAR (50),
    "reward_account_id" VARCHAR (150),
    "block_time" BIGINT,
    PRIMARY KEY ("session_id", "account_id")
);


CREATE TABLE dot_polka._account_identity (
    "account_id" varchar(50) PRIMARY KEY,
    "display" varchar(256),
    "legal" varchar(256),
    "web" varchar(256),
    "riot" varchar(256),
    "email" varchar(256),
    "twitter" varchar(256)
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
                                "section",
                                "method",
                                "data",
                                "event")
    VALUES (NEW."id",
            NEW."block_id",
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
                                "section",
                                "method",
                                "ref_event_ids",
                                "extrinsic")
    VALUES (NEW."id",
            NEW."block_id",
            NEW."section",
            NEW."method",
            NEW."ref_event_ids"::VARCHAR(150)[],
            NEW."extrinsic"::jsonb)
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
    INSERT INTO dot_polka.validators("session_id",
                                "account_id",
                                "era",
                                "is_enabled",
                                "total",
                                "own",
                                "reward_points",
                                "reward_dest",
                                "reward_account_id",
                                "block_time")
    VALUES (NEW."session_id",
            NEW."account_id",
            NEW."era",
            NEW."is_enabled",
            NEW."total"::BIGINT,
            NEW."own"::BIGINT,
            NEW."reward_points",
            NEW."reward_dest",
            NEW."reward_account_id",
            to_timestamp(NEW."block_time"))
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END ;

$$
    LANGUAGE 'plpgsql';

CREATE TRIGGER trg_events_sink_upsert
    BEFORE INSERT
    ON dot_polka._validators
    FOR EACH ROW
EXECUTE PROCEDURE dot_polka.sink_validators_insert();

CREATE OR REPLACE FUNCTION dot_polka.sink_trim_validators_after_insert()
    RETURNS trigger AS
$$
BEGIN
    DELETE FROM dot_polka._validators WHERE "session_id" = NEW."session_id"
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
    INSERT INTO dot_polka.nominators("session_id",
                                "account_id",
                                "era",
                                "validator",
                                "is_enabled",
                                "value",
                                "reward_dest",
                                "reward_account_id",
                                "block_time")
    VALUES (NEW."session_id",
            NEW."account_id",
            NEW."era",
            NEW."validator",
            NEW."is_enabled",
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
    DELETE FROM dot_polka._nominators WHERE "session_id" = NEW."session_id"
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



--  BI additions

CREATE MATERIALIZED VIEW dot_polka.mv_bi_accounts_balance TABLESPACE pg_default AS
SELECT ((e.data ->> 0)::jsonb) ->> 'AccountId' AS account_id,
                                   e.method,
                                   e.data,
                                   b.id AS block_id,
                                   b.era,
                                   b.block_time
FROM dot_polka.events e
JOIN dot_polka.blocks b ON b.id = e.block_id
WHERE e.section::text = 'balances'::text
ORDER BY e.block_id DESC WITH DATA;

REFRESH MATERIALIZED VIEW dot_polka.mv_bi_accounts_balance;




CREATE MATERIALIZED VIEW dot_polka.mv_bi_accounts_staking AS
SELECT ((e.data ->> 0)::jsonb) ->> 'AccountId' AS account_id,
								   CASE e.method WHEN 'Unbonded' THEN (((e.data ->> 1)::jsonb) ->> 'Balance')::DOUBLE PRECISION / 10000000000 * -1
										  ELSE (((e.data ->> 1)::jsonb) ->> 'Balance')::DOUBLE PRECISION / 10000000000
								   END AS balance,
                                   e.method,
                                   e.data,
                                   b.id AS block_id,
                                   b.era,
                                   b.block_time
FROM dot_polka.events e
JOIN dot_polka.blocks b ON b.id = e.block_id
WHERE e.section = 'staking'
ORDER BY e.block_id DESC WITH NO DATA;


REFRESH MATERIALIZED VIEW dot_polka.mv_bi_accounts_staking;
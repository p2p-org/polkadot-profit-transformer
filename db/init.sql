CREATE  SCHEMA IF NOT EXISTS dot_polka;


CREATE TABLE dot_polka._config (
    "key" VARCHAR (100) NOT NULL PRIMARY KEY,
    "value" TEXT
);

CREATE TABLE dot_polka.blocks (
    "id" BIGINT NOT NULL PRIMARY KEY,
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
    "id" VARCHAR(150) NOT NULL PRIMARY KEY,
    "block_id" BIGINT NOT NULL,
    "section" VARCHAR(50),
    "method" VARCHAR(50),
    "data" JSONB,
    "event" JSONB
);

CREATE TABLE dot_polka.extrinsics (
    "id" VARCHAR(150) NOT NULL PRIMARY KEY,
    "block_id" BIGINT NOT NULL,
    "section" VARCHAR(50),
    "method" VARCHAR(50),
    "ref_event_ids" VARCHAR(150)[],
    "extrinsic" JSONB
);


CREATE TABLE dot_polka.account_identity (
    "account_id" varchar(50) NOT NULL PRIMARY KEY,
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
    "id" BIGINT NOT NULL PRIMARY KEY,
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
    "id" VARCHAR(150) NOT NULL PRIMARY KEY,
    "block_id" BIGINT NOT NULL,
    "section" VARCHAR(30),
    "method" VARCHAR(30),
    "data" TEXT,
    "event" TEXT
);

CREATE TABLE dot_polka._extrinsics (
    "id" VARCHAR(150) NOT NULL PRIMARY KEY,
    "block_id" BIGINT NOT NULL,
    "section" VARCHAR(50),
    "method" VARCHAR(50),
    "ref_event_ids" TEXT,
    "extrinsic" TEXT
);

CREATE TABLE dot_polka._account_identity (
    "account_id" varchar(50) NOT NULL PRIMARY KEY,
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
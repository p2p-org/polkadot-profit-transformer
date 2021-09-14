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
    "current_era" INT,
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
    "total_reward" BIGINT,
    "total_stake" BIGINT,
    "total_reward_points" INT
);

CREATE TABLE dot_polka.validators (
    "era" INT,
    "account_id" VARCHAR(150),
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
    "judgement_status" varchar(256),
    "registrar_index" BIGINT,
    "created_at" BIGINT,
    "killed_at" BIGINT
);


CREATE TABLE dot_polka.proposal_preimage (
    "hash" varchar(256),
    "block_id" BIGINT,
    "event_id" VARCHAR(150),
    "extrinsic_id" VARCHAR(150),
    "event" VARCHAR(150),
    "data" JSONB,
    PRIMARY KEY ("hash")
);

CREATE TABLE dot_polka.technical_committee_proposal (
    "hash" varchar(256),
    "id" INTEGER NOT NULL,
    "block_id" BIGINT,
    "extrinsic_id" varchar(256),
    "event_id" varchar(256),
    "event" varchar(256),
    "data" JSONB,
    PRIMARY KEY ("hash", "extrinsic_id", "event_id")
);

CREATE TABLE dot_polka.democracy_referenda (
    "id" INTEGER NOT NULL,
    "block_id" BIGINT,
    "event_id" varchar(256),
    "extrinsic_id" varchar(256),
    "event" varchar(256),
    "data" JSONB,
    PRIMARY KEY ("id", "event_id", "extrinsic_id")
);

CREATE TABLE dot_polka.democracy_proposal (
    "id" INTEGER NOT NULL,
    "hash" varchar(256),
    "block_id" BIGINT,
    "event_id" varchar(256),
    "extrinsic_id" varchar(256),
    "event" varchar(256),
    "data" JSONB,
    PRIMARY KEY ("id", "event_id", "extrinsic_id")
);




CREATE TABLE dot_polka.preimage (
    "proposal_hash" varchar(256),
    "block_id" int,
    "event_id" varchar(256),
    "extrinsic_id" varchar(256),
    "event" varchar(256),
    "data" JSONB,
    PRIMARY KEY ("proposal_hash", "block_id", "event_id")
);



-- Internal tables


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
    "total_reward" TEXT,
    "total_stake" TEXT,
    "total_reward_points" INT
);

CREATE TABLE dot_polka._validators (
    "era" INT,
    "account_id" VARCHAR(150),
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

CREATE OR REPLACE FUNCTION  dot_polka.convert_to_jsonb_function()
RETURNS trigger AS 
$$
BEGIN
    NEW."digest" = cast(NEW."digest" as jsonb);
  RETURN NEW;
END;
$$ 
LANGUAGE 'plpgsql';

CREATE TRIGGER my_trigger
BEFORE INSERT ON dot_polka.blocks
FOR EACH ROW
EXECUTE PROCEDURE  dot_polka.convert_to_jsonb_function();

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

CREATE INDEX events_block_id ON dot_polka.events(block_id);

CREATE INDEX blocks_era ON dot_polka.blocks(era);

CREATE INDEX blocks_session_id ON dot_polka.blocks(session_id);

CREATE INDEX extrinsics_block_id ON dot_polka.extrinsics(block_id);






-- Validators


CREATE OR REPLACE FUNCTION dot_polka.sink_validators_insert()
    RETURNS trigger AS
$$
BEGIN
    INSERT INTO dot_polka.validators("era",
                                "account_id",
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
                                "is_clipped",
                                "value",
                                "reward_dest",
                                "reward_account_id",
                                "block_time")
    VALUES (NEW."era",
            NEW."account_id",
            NEW."validator",
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
                               "total_reward",
                               "total_stake",
                               "total_reward_points"
                               )
VALUES (NEW."era",
        NEW."session_start",
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

    if  (NEW."root_account_id" is null) then
		NEW."root_account_id" = OLD."root_account_id";
	end if;

    if  (NEW."display" is null) then
		NEW."display" = OLD."display";
	end if;

    if  (NEW."legal" is null) then
		NEW."legal" = OLD."legal";
	end if;

    if  (NEW."web" is null) then
		NEW."web" = OLD."web";
	end if;

    if  (NEW."riot" is null) then
		NEW."riot" = OLD."riot";
	end if;

    if  (NEW."email" is null) then
		NEW."email" = OLD."email";
	end if;

    if  (NEW."twitter" is null) then
		NEW."twitter" = OLD."twitter";
	end if;

    if  (NEW."judgement_status" is null) then
		NEW."judgement_status" = OLD."judgement_status";
	end if;

    if  (NEW."registrar_index" is null) then
		NEW."registrar_index" = OLD."registrar_index";
	end if;

    if  (NEW."created_at" is null) then
		NEW."created_at" = OLD."created_at";
	end if;

    if  (NEW."killed_at" is null) then
		NEW."killed_at" = OLD."killed_at";
	end if;


RETURN NEW;
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

CREATE MATERIALIZED VIEW dot_polka.nominator_validator_apy AS 

SELECT block_time, era, nominator, validator, nominator_stake, commission,
        validator_points / era_points * era_rewards / validator_total * 365 *100 as validator_APR,
        era_rewards * validator_points / era_points as val_total_rewards,
        CASE WHEN nominator_stake>0 AND validator_points>0 
            THEN CASE WHEN commission = 0 
                    THEN era_rewards * validator_points / era_points / validator_total * nominator_stake * 1 
                    ELSE era_rewards * validator_points / era_points / validator_total * nominator_stake * (1 - commission/ 100) END
            ELSE 0 END as nominator_income,
        CASE WHEN nominator_stake>0 AND validator_points>0 
            THEN CASE WHEN commission = 0 
                THEN (era_rewards * validator_points / era_points / validator_total * nominator_stake) / nominator_stake* 100*365 * 1 
                ELSE (era_rewards * validator_points / era_points / validator_total * nominator_stake) / nominator_stake * 100*365 * (1 - commission/ 100)  END
            ELSE 0 END as nom_APY
FROM (
    SELECT n.era, n.account_id as nominator, (SUM(n.value) /10^10)::float as nominator_stake, n.block_time,
          validator, SUM((v.total/10^10)::float) as validator_total, SUM((v.own/10^10)::float) as validator_own, (SUM(v.reward_points))::float as validator_points,
          CASE WHEN (prefs->'commission')::float !=1 THEN (prefs->'commission')::float/10^7 ELSE 0 END as commission,
          MAX((e.total_reward / 10^10)::float) as era_rewards, MAX((e.total_stake / 10^10)::float) as era_stake, MAX((total_reward_points)::float) as era_points
    FROM dot_polka.nominators as n
        INNER JOIN dot_polka.validators as v ON v.account_id = n.validator AND v.era = n.era
        INNER JOIN dot_polka.eras as e ON e.era = n.era
    GROUP BY n.era, n.block_time, n.account_id, validator,prefs
    ) as grouped;

REFRESH MATERIALIZED VIEW dot_polka.nominator_validator_apy;


CREATE MATERIALIZED VIEW dot_polka.nominator_apy AS 

SELECT d.era, nominator, nominator_stake, nominator_income, nom_APY, max_APY, avg_APY, min_APY
FROM (
        SELECT era, nominator, nominator_stake, commission,
        CASE WHEN nominator_stake>0 AND validator_points>0 
            THEN CASE WHEN commission = 0 
                    THEN era_rewards * validator_points / era_points / validator_total * nominator_stake * 1 
                    ELSE era_rewards * validator_points / era_points / validator_total * nominator_stake * (1 - commission/ 100) END
            ELSE 0 END as nominator_income,
        CASE WHEN nominator_stake>0 AND validator_points>0 
            THEN CASE WHEN commission = 0 
                THEN (era_rewards * validator_points / era_points / validator_total * nominator_stake) / nominator_stake* 100*365 * 1 
                ELSE (era_rewards * validator_points / era_points / validator_total * nominator_stake) / nominator_stake * 100*365 * (1 - commission/ 100)  END
            ELSE 0 END as nom_APY
        FROM (
                SELECT n.era, n.account_id as nominator, (SUM(n.value) /10^10)::float as nominator_stake, prefs,
                      validator, SUM((v.total/10^10)::float) as validator_total, (SUM(v.reward_points))::float as validator_points, CASE WHEN (prefs->'commission')::float !=1 THEN (prefs->'commission')::float/10^7 ELSE 0 END as commission ,
                      MAX((e.total_reward / 10^10)::float) as era_rewards, MAX((e.total_stake / 10^10)::float) as era_stake, MAX((total_reward_points)::float) as era_points
                FROM dot_polka.nominators as n
                    INNER JOIN dot_polka.validators as v ON v.account_id = n.validator AND v.era = n.era
                    INNER JOIN dot_polka.eras as e ON e.era = n.era 
                GROUP BY n.era, n.account_id, validator, prefs
            ) as data
                ) as d
            INNER JOIN  (SELECT era, MAX(apy) as max_apy, AVG(APY) as avg_apy, min(apy) as min_apy
                        FROM (SELECT era,
                                    CASE WHEN nominator_stake>0 AND validator_points>0 
                                        THEN CASE WHEN commission = 0 
                                            THEN (era_rewards * validator_points / era_points / validator_total * nominator_stake) / nominator_stake* 100*365 * 1 
                                            ELSE (era_rewards * validator_points / era_points / validator_total * nominator_stake) / nominator_stake * 100*365 * (1 - commission/ 100)  END
                                        ELSE 0 END as APY
                        FROM (
                                SELECT n.era, n.account_id as nominator, (SUM(n.value) /10^10)::float as nominator_stake,
                                validator, SUM((v.total/10^10)::float) as validator_total, (SUM(v.reward_points))::float as validator_points, CASE WHEN (prefs->'commission')::float !=1 THEN (prefs->'commission')::float/10^7 ELSE 0 END as commission ,
                                MAX((e.total_reward / 10^10)::float) as era_rewards, MAX((e.total_stake / 10^10)::float) as era_stake, MAX((total_reward_points)::float) as era_points
                                FROM dot_polka.nominators as n
                                    INNER JOIN dot_polka.validators as v ON v.account_id = n.validator AND v.era = n.era
                                    INNER JOIN dot_polka.eras as e ON e.era = n.era 
                                GROUP BY n.block_time, n.era, n.account_id, validator, prefs
                                    ) as pre_max_min
                        ) as max_min 
            GROUP by era ) as max_min_grouped
            ON max_min_grouped.era=d.era
ORDER by d.era desc;


REFRESH MATERIALIZED VIEW dot_polka.nominator_apy;

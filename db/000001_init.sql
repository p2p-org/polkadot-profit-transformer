CREATE TABLE networks (
    "id" SERIAL,
    "name" VARCHAR (100)  PRIMARY KEY
);

CREATE TABLE blocks (
    "network_id" INT,
    "id" BIGINT,
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
    "block_time" TIMESTAMP,
    PRIMARY KEY ("id", "network_id")
);



CREATE TABLE events (
    "network_id" INT,
    "id" VARCHAR(150),
    "block_id" BIGINT NOT NULL,
    "session_id" INT,
    "era" INT,
    "section" VARCHAR(50),
    "method" VARCHAR(50),
    "data" JSONB,
    "event" JSONB,
    PRIMARY KEY ("id", "network_id")

);

CREATE TABLE extrinsics (
    "network_id" INT,
    "id" VARCHAR(150),
    "block_id" BIGINT NOT NULL,
    "success" BOOL,
    "parent_id" VARCHAR(150),
    "session_id" INT,
    "era" INT,
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
    "args" JSONB,
    PRIMARY KEY ("id", "network_id")

);


CREATE TABLE eras (
    "network_id" INT,
    "era" INT,
    "session_start" INT,
    "total_reward" BIGINT,
    "total_stake" BIGINT,
    "total_reward_points" INT,
    PRIMARY KEY ("era", "network_id")

);

CREATE TABLE validators (
    "network_id" INT,
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
    PRIMARY KEY ("era", "account_id", "network_id")
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
    PRIMARY KEY ("era", "account_id", "validator", "network_id")
);

CREATE TABLE account_identity (
    "network_id" INT,
    "account_id" varchar(50),
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
    "killed_at" BIGINT,
    PRIMARY KEY ("account_id", "network_id")
);

CREATE TABLE technical_committee_proposal (
    "network_id" INT,
    "hash" varchar(256),
    "id" INTEGER,
    "block_id" BIGINT,
    "extrinsic_id" varchar(256),
    "event_id" varchar(256),
    "event" varchar(256),
    "data" JSONB,
    PRIMARY KEY ("hash", "extrinsic_id", "event_id", "network_id")
);

CREATE TABLE democracy_referenda (
    "network_id" INT,
    "id" INTEGER NOT NULL,
    "block_id" BIGINT,
    "event_id" varchar(256),
    "extrinsic_id" varchar(256),
    "event" varchar(256),
    "data" JSONB,
    PRIMARY KEY ("id", "event_id", "extrinsic_id", "network_id")
);

CREATE TABLE democracy_proposal (
    "network_id" INT,
    "id" INTEGER NOT NULL,
    "hash" varchar(256),
    "block_id" BIGINT,
    "event_id" varchar(256),
    "extrinsic_id" varchar(256),
    "event" varchar(256),
    "data" JSONB,
    PRIMARY KEY ("id", "event_id", "extrinsic_id", "network_id")
);


CREATE TABLE council_proposal (
    "network_id" INT,
    "id" INTEGER NOT NULL,
    "hash" varchar(256),
    "block_id" BIGINT,
    "event_id" varchar(256),
    "extrinsic_id" varchar(256),
    "event" varchar(256),
    "data" JSONB,
    PRIMARY KEY ("id", "event_id", "extrinsic_id", "network_id")
);

CREATE TABLE treasury_proposal (
    "network_id" INT,
    "id" INTEGER NOT NULL,
    "block_id" BIGINT,
    "event_id" varchar(256),
    "extrinsic_id" varchar(256),
    "event" varchar(256),
    "data" JSONB,
    PRIMARY KEY ("id", "event_id", "extrinsic_id", "network_id")
);


CREATE TABLE tips (
    "network_id" INT,
    "hash" varchar(256),
    "block_id" BIGINT,
    "event_id" varchar(256),
    "extrinsic_id" varchar(256),
    "event" varchar(256),
    "data" JSONB,
    PRIMARY KEY ("hash", "event_id", "extrinsic_id", "network_id")
);



CREATE TABLE preimage (
    "network_id" INT,
    "proposal_hash" varchar(256),
    "block_id" int,
    "event_id" varchar(256),
    "extrinsic_id" varchar(256),
    "event" varchar(256),
    "data" JSONB,
    PRIMARY KEY ("proposal_hash", "block_id", "event_id", "network_id")
);

CREATE INDEX mbelt_account_identity_account_id_idx ON account_identity (account_id, network_id);

CREATE INDEX events_block_id ON events(block_id, network_id);

CREATE INDEX blocks_era ON blocks(era, network_id);

CREATE INDEX blocks_session_id ON blocks(session_id, network_id);

CREATE INDEX extrinsics_block_id ON extrinsics(block_id, network_id);

--  BI additions

-- CREATE MATERIALIZED VIEW mv_bi_accounts_balance TABLESPACE pg_default AS
-- SELECT
--            e.session_id,
--            e.era,
--            ((e.data ->> 0)::jsonb) ->> 'AccountId' AS account_id,
--            e.method,
--            e.data,
--            b.id AS block_id,
--            b.block_time
-- FROM events e
-- JOIN blocks b ON b.id = e.block_id
-- WHERE e.section::text = 'balances'::text
-- ORDER BY e.block_id DESC WITH DATA;

-- REFRESH MATERIALIZED VIEW mv_bi_accounts_balance;

-- CREATE MATERIALIZED VIEW mv_bi_accounts_staking AS
-- SELECT
--            e.session_id,
--            e.era,
--             ((e.data ->> 0)::jsonb) ->> 'AccountId' AS account_id,
--            e.method,
--            CASE WHEN e.method IN ('Unbonded', 'Slash', 'Withdrawn') THEN (((e.data ->> 1)::jsonb) ->> 'Balance')::DOUBLE PRECISION / 10^10 * -1
--                   ELSE (((e.data ->> 1)::jsonb) ->> 'Balance')::DOUBLE PRECISION / 10^10
--            END AS balance,
--            b.block_time
-- FROM events e
-- JOIN blocks b ON b.id = e.block_id
-- WHERE e.section = 'staking' AND e.method IN ('Bonded', 'Reward', 'Slash', 'Unbonded', 'Withdrawn')
-- ORDER BY e.block_id DESC WITH DATA;

-- REFRESH MATERIALIZED VIEW mv_bi_accounts_staking;

-- CREATE MATERIALIZED VIEW nominator_validator_apy AS 

-- SELECT block_time, era, nominator, validator, nominator_stake, commission,
--         validator_points / era_points * era_rewards / validator_total * 365 *100 as validator_APR,
--         era_rewards * validator_points / era_points as val_total_rewards,
--         CASE WHEN nominator_stake>0 AND validator_points>0 
--             THEN CASE WHEN commission = 0 
--                     THEN era_rewards * validator_points / era_points / validator_total * nominator_stake * 1 
--                     ELSE era_rewards * validator_points / era_points / validator_total * nominator_stake * (1 - commission/ 100) END
--             ELSE 0 END as nominator_income,
--         CASE WHEN nominator_stake>0 AND validator_points>0 
--             THEN CASE WHEN commission = 0 
--                 THEN (era_rewards * validator_points / era_points / validator_total * nominator_stake) / nominator_stake* 100*365 * 1 
--                 ELSE (era_rewards * validator_points / era_points / validator_total * nominator_stake) / nominator_stake * 100*365 * (1 - commission/ 100)  END
--             ELSE 0 END as nom_APY
-- FROM (
--     SELECT n.era, n.account_id as nominator, (SUM(n.value) /10^10)::float as nominator_stake, n.block_time,
--           validator, SUM((v.total/10^10)::float) as validator_total, SUM((v.own/10^10)::float) as validator_own, (SUM(v.reward_points))::float as validator_points,
--           CASE WHEN (prefs->'commission')::float !=1 THEN (prefs->'commission')::float/10^7 ELSE 0 END as commission,
--           MAX((e.total_reward / 10^10)::float) as era_rewards, MAX((e.total_stake / 10^10)::float) as era_stake, MAX((total_reward_points)::float) as era_points
--     FROM nominators as n
--         INNER JOIN validators as v ON v.account_id = n.validator AND v.era = n.era
--         INNER JOIN eras as e ON e.era = n.era
--     GROUP BY n.era, n.block_time, n.account_id, validator,prefs
--     ) as grouped;

-- REFRESH MATERIALIZED VIEW nominator_validator_apy;


-- CREATE MATERIALIZED VIEW nominator_apy AS 

-- SELECT d.era, nominator, nominator_stake, nominator_income, nom_APY, max_APY, avg_APY, min_APY
-- FROM (
--         SELECT era, nominator, nominator_stake, commission,
--         CASE WHEN nominator_stake>0 AND validator_points>0 
--             THEN CASE WHEN commission = 0 
--                     THEN era_rewards * validator_points / era_points / validator_total * nominator_stake * 1 
--                     ELSE era_rewards * validator_points / era_points / validator_total * nominator_stake * (1 - commission/ 100) END
--             ELSE 0 END as nominator_income,
--         CASE WHEN nominator_stake>0 AND validator_points>0 
--             THEN CASE WHEN commission = 0 
--                 THEN (era_rewards * validator_points / era_points / validator_total * nominator_stake) / nominator_stake* 100*365 * 1 
--                 ELSE (era_rewards * validator_points / era_points / validator_total * nominator_stake) / nominator_stake * 100*365 * (1 - commission/ 100)  END
--             ELSE 0 END as nom_APY
--         FROM (
--                 SELECT n.era, n.account_id as nominator, (SUM(n.value) /10^10)::float as nominator_stake, prefs,
--                       validator, SUM((v.total/10^10)::float) as validator_total, (SUM(v.reward_points))::float as validator_points, CASE WHEN (prefs->'commission')::float !=1 THEN (prefs->'commission')::float/10^7 ELSE 0 END as commission ,
--                       MAX((e.total_reward / 10^10)::float) as era_rewards, MAX((e.total_stake / 10^10)::float) as era_stake, MAX((total_reward_points)::float) as era_points
--                 FROM nominators as n
--                     INNER JOIN validators as v ON v.account_id = n.validator AND v.era = n.era
--                     INNER JOIN eras as e ON e.era = n.era 
--                 GROUP BY n.era, n.account_id, validator, prefs
--             ) as data
--                 ) as d
--             INNER JOIN  (SELECT era, MAX(apy) as max_apy, AVG(APY) as avg_apy, min(apy) as min_apy
--                         FROM (SELECT era,
--                                     CASE WHEN nominator_stake>0 AND validator_points>0 
--                                         THEN CASE WHEN commission = 0 
--                                             THEN (era_rewards * validator_points / era_points / validator_total * nominator_stake) / nominator_stake* 100*365 * 1 
--                                             ELSE (era_rewards * validator_points / era_points / validator_total * nominator_stake) / nominator_stake * 100*365 * (1 - commission/ 100)  END
--                                         ELSE 0 END as APY
--                         FROM (
--                                 SELECT n.era, n.account_id as nominator, (SUM(n.value) /10^10)::float as nominator_stake,
--                                 validator, SUM((v.total/10^10)::float) as validator_total, (SUM(v.reward_points))::float as validator_points, CASE WHEN (prefs->'commission')::float !=1 THEN (prefs->'commission')::float/10^7 ELSE 0 END as commission ,
--                                 MAX((e.total_reward / 10^10)::float) as era_rewards, MAX((e.total_stake / 10^10)::float) as era_stake, MAX((total_reward_points)::float) as era_points
--                                 FROM nominators as n
--                                     INNER JOIN validators as v ON v.account_id = n.validator AND v.era = n.era
--                                     INNER JOIN eras as e ON e.era = n.era 
--                                 GROUP BY n.block_time, n.era, n.account_id, validator, prefs
--                                     ) as pre_max_min
--                         ) as max_min 
--             GROUP by era ) as max_min_grouped
--             ON max_min_grouped.era=d.era
-- ORDER by d.era desc;


-- REFRESH MATERIALIZED VIEW nominator_apy;

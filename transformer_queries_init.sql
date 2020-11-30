-- create_block_data_stream

CREATE STREAM block_data (
    "block" VARCHAR,
    "extrinsics" ARRAY < VARCHAR >,
    "events" ARRAY < VARCHAR >,
    "block_time" BIGINT
) WITH (
    kafka_topic = 'block_data',
    value_format = 'JSON'
);

-- create_block_stream

CREATE STREAM BLOCK (
    "id" BIGINT,
    "hash" STRING,
    "state_root" STRING,
    "extrinsics_root" STRING,
    "parent_hash" STRING,
    "author" STRING,
    "session_id" INT,
    "era" INT,
    "last_log" STRING,
    "digest" STRING,
    "block_time" BIGINT
) WITH (
    KAFKA_TOPIC='BLOCK',
    PARTITIONS=1,
    REPLICAS=1,
    VALUE_FORMAT='AVRO'
);

INSERT INTO BLOCK SELECT
                      CAST(EXTRACTJSONFIELD(BLOCK_DATA."block", '$.header.number') AS BIGINT) "id",
                      EXTRACTJSONFIELD(BLOCK_DATA."block", '$.header.hash') "hash",
                      EXTRACTJSONFIELD(BLOCK_DATA."block", '$.header.stateRoot') "state_root",
                      EXTRACTJSONFIELD(BLOCK_DATA."block", '$.header.extrinsicsRoot') "extrinsics_root",
                      EXTRACTJSONFIELD(BLOCK_DATA."block", '$.header.parentHash') "parent_hash",
                      EXTRACTJSONFIELD(BLOCK_DATA."block", '$.header.author') "author",
                      CAST(EXTRACTJSONFIELD(BLOCK_DATA."block", '$.header.session_id') AS INT) "session_id",
                      CAST(EXTRACTJSONFIELD(BLOCK_DATA."block", '$.header.era') AS INT) "era",
                      EXTRACTJSONFIELD(BLOCK_DATA."block", '$.header.last_log') "last_log",
                      EXTRACTJSONFIELD(BLOCK_DATA."block", '$.header.digest') "digest",
                      BLOCK_DATA."block_time" "block_time"
FROM BLOCK_DATA BLOCK_DATA
EMIT CHANGES;

-- create_event_stream

CREATE STREAM event (
    "block_id" BIGINT,
    "session_id" INT,
    "era" INT,
    "event" STRING
) WITH (
    kafka_topic = 'EVENT',
    PARTITIONS = 1,
    VALUE_FORMAT = 'AVRO',
    REPLICAS = 1
);

INSERT INTO event
SELECT
    CAST(extractjsonfield(BLOCK_DATA."block", '$.header.number') AS BIGINT) AS "block_id",
    CAST(EXTRACTJSONFIELD(BLOCK_DATA."block", '$.header.session_id') AS INT) "session_id",
    CAST(EXTRACTJSONFIELD(BLOCK_DATA."block", '$.header.era') AS INT) "era",
    EXPLODE(BLOCK_DATA."events") AS "event"

FROM BLOCK_DATA BLOCK_DATA EMIT CHANGES;

-- create_event_extraction

CREATE STREAM EVENT_EXTRACTION (
    "id" STRING,
    "block_id" BIGINT,
    "session_id" INT,
    "era" INT,
    "section" STRING,
    "method" STRING,
    "data" STRING,
    "event" STRING
) WITH (
    KAFKA_TOPIC='EVENT_EXTRACTION',
    PARTITIONS=1,
    REPLICAS=1,
    VALUE_FORMAT='AVRO'
);

INSERT INTO EVENT_EXTRACTION SELECT
    extractjsonfield(E."event", '$.id') "id",
    E."block_id" "block_id",
    E."session_id" "session_id",
    E."era" "era",
    extractjsonfield(E."event", '$.section') "section",
    extractjsonfield(E."event", '$.method') "method",
    extractjsonfield(E."event", '$.data') "data",
    extractjsonfield(E."event", '$.event') "event"
FROM EVENT E
EMIT CHANGES;

-- create_extrinsic_stream
CREATE STREAM extrinsic (
    "block_id" BIGINT,
    "extrinsic" STRING
) WITH (
    kafka_topic = 'EXTRINSIC',
    PARTITIONS = 1,
    VALUE_FORMAT = 'AVRO',
    REPLICAS = 1
);

INSERT INTO extrinsic
SELECT
    CAST(extractjsonfield(BLOCK_DATA."block", '$.header.number') AS BIGINT) AS "block_id",
    EXPLODE(BLOCK_DATA."extrinsics") AS "extrinsic"

FROM BLOCK_DATA BLOCK_DATA EMIT CHANGES;

-- create_extrinsic_extraction

CREATE STREAM EXTRINSIC_EXTRACTION (
    "id" STRING,
    "block_id" BIGINT,
    "section" STRING,
    "method" STRING,
    "ref_event_ids" STRING,
    "extrinsic" STRING
) WITH (
    KAFKA_TOPIC='EXTRINSIC_EXTRACTION',
    PARTITIONS=1,
    REPLICAS=1,
    VALUE_FORMAT='AVRO'
);

INSERT INTO EXTRINSIC_EXTRACTION SELECT
    extractjsonfield(E."extrinsic", '$.id') "id",
    E."block_id" "block_id",
    extractjsonfield(E."extrinsic", '$.section') "section",
    extractjsonfield(E."extrinsic", '$.method') "method",
    extractjsonfield(E."extrinsic", '$.ref_event_ids') "ref_event_ids",
    extractjsonfield(E."extrinsic", '$.extrinsic')  "extrinsic"
FROM EXTRINSIC E
EMIT CHANGES;

-- session data

CREATE STREAM session_data (
    "session_id" INT,
    "era" INT,
    "block_end" BIGINT,
    "validators" ARRAY < VARCHAR >,
    "nominators" ARRAY < VARCHAR >,
    "block_time" BIGINT
) WITH (
    kafka_topic = 'session_data',
    value_format = 'JSON'
);

CREATE STREAM SESSION_END (
    "id" INT,
    "era" INT,
    "block_end" BIGINT,
    "block_time" BIGINT
) WITH (
    KAFKA_TOPIC='SESSION_END',
    PARTITIONS=1,
    REPLICAS=1,
    VALUE_FORMAT='AVRO'
);

INSERT INTO SESSION_END SELECT
                      SESSION_DATA."session_id" "id",
                      SESSION_DATA."era" "era",
                      SESSION_DATA."block_end" "block_end",
                      (SESSION_DATA."block_time" / 1000) "block_time"
FROM SESSION_DATA SESSION_DATA
EMIT CHANGES;

-- staking_validator

CREATE STREAM staking_validator (
    "session_id" INT,
    "validator" STRING
) WITH (
    kafka_topic = 'STAKING_VALIDATOR',
    PARTITIONS = 1,
    VALUE_FORMAT = 'AVRO',
    REPLICAS = 1
);

INSERT INTO staking_validator
SELECT
    SESSION_DATA."session_id" "session_id",
    EXPLODE(SESSION_DATA."validators") AS "validator"
FROM SESSION_DATA SESSION_DATA EMIT CHANGES;

CREATE STREAM STAKING_VALIDATOR_EXTRACTION (
    "era" INT,
    "account_id" STRING,
    "is_enabled" BOOLEAN,
    "total" STRING,
    "own" STRING,
    "reward_points" INT,
    "reward_dest" STRING,
    "reward_account_id" STRING,
    "nominators_count" INT,
    "prefs" STRING,
    "block_time" BIGINT
) WITH (
    KAFKA_TOPIC='STAKING_VALIDATOR_EXTRACTION',
    PARTITIONS=1,
    REPLICAS=1,
    VALUE_FORMAT='AVRO'
);

INSERT INTO STAKING_VALIDATOR_EXTRACTION SELECT
    CAST(extractjsonfield(E."validator", '$.era') AS INT) "era",
    extractjsonfield(E."validator", '$.account_id') "account_id",
    CAST(extractjsonfield(E."validator", '$.is_enabled') AS BOOLEAN) "is_enabled",
    extractjsonfield(E."validator", '$.total') "total",
    extractjsonfield(E."validator", '$.own') "own",
    CAST(extractjsonfield(E."validator", '$.reward_points') AS INT) "reward_points",
    extractjsonfield(E."validator", '$.reward_dest') "reward_dest",
    extractjsonfield(E."validator", '$.reward_account_id') "reward_account_id",
    CAST(extractjsonfield(E."validator", '$.nominators_count') AS INT) "nominators_count",
    extractjsonfield(E."validator", '$.prefs') "prefs",
    (CAST(extractjsonfield(E."validator", '$.block_time') AS BIGINT) / 1000) "block_time"
FROM STAKING_VALIDATOR E
EMIT CHANGES;


CREATE STREAM staking_nominator (
    "session_id" INT,
    "nominator" STRING
) WITH (
    kafka_topic = 'STAKING_NOMINATOR',
    PARTITIONS = 1,
    VALUE_FORMAT = 'AVRO',
    REPLICAS = 1
);

INSERT INTO staking_nominator
SELECT
    SESSION_DATA."session_id" "session_id",
    EXPLODE(SESSION_DATA."nominators") AS "nominator"
FROM SESSION_DATA SESSION_DATA EMIT CHANGES;

CREATE STREAM STAKING_NOMINATOR_EXTRACTION (
    "era" INT,
    "account_id" STRING,
    "validator" STRING,
    "is_enabled" BOOLEAN,
    "is_clipped" BOOLEAN,
    "value" STRING,
    "reward_dest" STRING,
    "reward_account_id" STRING,
    "block_time" BIGINT
) WITH (
    KAFKA_TOPIC='STAKING_NOMINATOR_EXTRACTION',
    PARTITIONS=1,
    REPLICAS=1,
    VALUE_FORMAT='AVRO'
);

INSERT INTO STAKING_NOMINATOR_EXTRACTION SELECT
    CAST(extractjsonfield(E."nominator", '$.era') AS INT) "era",
    extractjsonfield(E."nominator", '$.account_id') "account_id",
    extractjsonfield(E."nominator", '$.validator') "validator",
    CAST(extractjsonfield(E."nominator", '$.is_enabled') AS BOOLEAN) "is_enabled",
    CAST(extractjsonfield(E."nominator", '$.is_clipped') AS BOOLEAN) "is_clipped",
    extractjsonfield(E."nominator", '$.value') "value",
    extractjsonfield(E."nominator", '$.reward_dest') "reward_dest",
    extractjsonfield(E."nominator", '$.reward_account_id') "reward_account_id",
    (CAST(extractjsonfield(E."nominator", '$.block_time') AS BIGINT) / 1000) "block_time"
FROM STAKING_NOMINATOR E
EMIT CHANGES;


CREATE STREAM ENRICHMENT_ACCOUNT_CHANGES (
    "event_id" STRING,
    "account_id" STRING,
    "event" STRING,
    "block_id" BIGINT
) WITH (
    KAFKA_TOPIC='ENRICHMENT_ACCOUNT_CHANGES',
    PARTITIONS=1,
    REPLICAS=1,
    VALUE_FORMAT='JSON'
);

INSERT INTO ENRICHMENT_ACCOUNT_CHANGES SELECT
    extractjsonfield(E."event", '$.id') "event_id",
    extractjsonfield(E."event", '$.data[0].AccountId') "account_id",
    extractjsonfield(E."event", '$.method') "event",
    E."block_id" "block_id"
FROM EVENT E
WHERE
    extractjsonfield(E."event", '$.section') = 'system'
    AND (
            extractjsonfield(E."event", '$.method') = 'NewAccount' OR
            extractjsonfield(E."event", '$.method') = 'KilledAccount'
        )
EMIT CHANGES;

-- create_profit_events_filter_rules
-- {"ksql":"CREATE TABLE profit_events_filter_rules (method VARCHAR) WITH (kafka_topic='profit_events_filter_rules', value_format='JSON', KEY='method');"}
CREATE TABLE profit_events_filter_rules (method VARCHAR(30)) WITH (
                                                                 KAFKA_TOPIC = 'profit_events_filter_rules',
                                                                 VALUE_FORMAT = 'JSON',
                                                                 KEY = 'method',
                                                                 PARTITIONS = 1,
                                                                 REPLICAS = 1
                                                                 );
INSERT INTO profit_events_filter_rules (method) VALUES ('Reward');
INSERT INTO profit_events_filter_rules (method) VALUES ('Deposit');

-- create_profit_events_filter_rules_stream

CREATE STREAM profit_events_filter (
    "block_id" BIGINT,
    "event" STRING
) WITH (
    kafka_topic = 'PROFIT_EVENTS_FILTER',
    PARTITIONS = 1,
    VALUE_FORMAT = 'AVRO',
    REPLICAS = 1
);

INSERT INTO profit_events_filter
SELECT
    E."block_id" "block_id",
    E."event" "event"
FROM EVENT E
         INNER JOIN PROFIT_EVENTS_FILTER_RULES P ON extractjsonfield(E."event", '$.method') = P.method
WHERE extractjsonfield(E."event", '$.section') != 'treasury'
EMIT CHANGES;


-- create_balances_stream

CREATE STREAM BALANCES (
    "block_id" BIGINT,
    "block_time" BIGINT,
    "method" STRING,
    "account_id" STRING,
    "balance" BIGINT
) WITH (
    KAFKA_TOPIC='BALANCES',
    PARTITIONS=1,
    REPLICAS=1,
    VALUE_FORMAT='AVRO'
);

INSERT INTO BALANCES SELECT
                         CAST(PROFIT_EVENTS_FILTER."block_id" AS BIGINT)  "block_id",
                         EXTRACTJSONFIELD(PROFIT_EVENTS_FILTER."event", '$.method') "method",
                         EXTRACTJSONFIELD(PROFIT_EVENTS_FILTER."event", '$.data.AccountId') "account_id",
                         CAST(EXTRACTJSONFIELD(PROFIT_EVENTS_FILTER."event", '$.data.Balance') AS BIGINT) "balance",
                         BLOCK."block_time" "block_time"
FROM PROFIT_EVENTS_FILTER PROFIT_EVENTS_FILTER
         INNER JOIN BLOCK BLOCK WITHIN 5 HOURS ON ((BLOCK."id" = CAST(PROFIT_EVENTS_FILTER."block_id" AS BIGINT))
EMIT CHANGES;

-- create_balances_with_is_validator

CREATE STREAM BALANCES_WITH_IS_VALIDATOR WITH (
    KAFKA_TOPIC = 'BALANCES_WITH_IS_VALIDATOR',
    PARTITIONS = 1,
    REPLICAS = 1
) AS
SELECT
    BALANCES.BLOCK_NUMBER "block_id",
    BALANCES.ACCOUNT_ID "account_id",
    BALANCES.BALANCE "balance",
    BALANCES.METHOD "method",
    IS_VALIDATOR(
           CAST(BLOCK_DATA.EXTRINSICS AS STRING),
           BALANCES.ACCOUNT_ID
       ) "is_validator",
    BALANCES.CREATE_TIME "block_time"
FROM BALANCES BALANCES
         LEFT OUTER JOIN BLOCK_DATA BLOCK_DATA WITHIN 10000000 DAYS ON ((
        BALANCES.BLOCK_NUMBER = CAST(EXTRACTJSONFIELD(BLOCK_DATA.BLOCK, '$.header.number') AS INTEGER
    )))
EMIT CHANGES;
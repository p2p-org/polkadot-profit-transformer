
CREATE STREAM {APP_PREFIX}_staking_validator (
    "session_id" INT,
    "validator" STRING
) WITH (
    kafka_topic = '{APP_PREFIX}_STAKING_VALIDATOR',
    PARTITIONS = 1,
    VALUE_FORMAT = 'AVRO',
    REPLICAS = 1
);

INSERT INTO {APP_PREFIX}_staking_validator
SELECT
    S."session_id" "session_id",
    EXPLODE(S."validators") AS "validator"
FROM {APP_PREFIX}_SESSION_DATA S
    EMIT CHANGES;

CREATE STREAM {APP_PREFIX}_STAKING_VALIDATOR_EXTRACTION (
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
    KAFKA_TOPIC='{APP_PREFIX}_STAKING_VALIDATOR_EXTRACTION',
    PARTITIONS=1,
    REPLICAS=1,
    VALUE_FORMAT='AVRO'
);

INSERT INTO {APP_PREFIX}_STAKING_VALIDATOR_EXTRACTION SELECT
                                             CAST(extractjsonfield(N."validator", '$.era') AS INT) "era",
                                             extractjsonfield(N."validator", '$.account_id') "account_id",
                                             CAST(extractjsonfield(N."validator", '$.is_enabled') AS BOOLEAN) "is_enabled",
                                             extractjsonfield(N."validator", '$.total') "total",
                                             extractjsonfield(N."validator", '$.own') "own",
                                             CAST(extractjsonfield(N."validator", '$.reward_points') AS INT) "reward_points",
                                             extractjsonfield(N."validator", '$.reward_dest') "reward_dest",
                                             extractjsonfield(N."validator", '$.reward_account_id') "reward_account_id",
                                             CAST(extractjsonfield(N."validator", '$.nominators_count') AS INT) "nominators_count",
                                             extractjsonfield(N."validator", '$.prefs') "prefs",
                                             (CAST(extractjsonfield(N."validator", '$.block_time') AS BIGINT) / 1000) "block_time"
FROM {APP_PREFIX}_STAKING_VALIDATOR N
    EMIT CHANGES;
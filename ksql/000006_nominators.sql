CREATE STREAM {APP_PREFIX}_staking_nominator (
    "era" INT,
    "nominator" STRING
) WITH (
    kafka_topic = '{APP_PREFIX}_STAKING_NOMINATOR',
    PARTITIONS = 1,
    VALUE_FORMAT = 'AVRO',
    REPLICAS = 1
);

INSERT INTO {APP_PREFIX}_staking_nominator
SELECT
    S."era" "era",
    EXPLODE(S."nominators") AS "nominator"
FROM {APP_PREFIX}_SESSION_DATA S
    EMIT CHANGES;

CREATE STREAM {APP_PREFIX}_STAKING_NOMINATOR_EXTRACTION (
    "era" INT,
    "account_id" STRING,
    "validator" STRING,
    "is_clipped" BOOLEAN,
    "value" STRING,
    "reward_dest" STRING,
    "reward_account_id" STRING,
    "block_time" BIGINT
) WITH (
    KAFKA_TOPIC='{APP_PREFIX}_STAKING_NOMINATOR_EXTRACTION',
    PARTITIONS=1,
    REPLICAS=1,
    VALUE_FORMAT='AVRO'
);

INSERT INTO {APP_PREFIX}_STAKING_NOMINATOR_EXTRACTION SELECT
                                             CAST(extractjsonfield(N."nominator", '$.era') AS INT) "era",
                                             extractjsonfield(N."nominator", '$.account_id') "account_id",
                                             extractjsonfield(N."nominator", '$.validator') "validator",
                                             CAST(extractjsonfield(N."nominator", '$.is_clipped') AS BOOLEAN) "is_clipped",
                                             extractjsonfield(N."nominator", '$.value') "value",
                                             extractjsonfield(N."nominator", '$.reward_dest') "reward_dest",
                                             extractjsonfield(N."nominator", '$.reward_account_id') "reward_account_id",
                                             (CAST(extractjsonfield(N."nominator", '$.block_time') AS BIGINT) / 1000) "block_time"
FROM {APP_PREFIX}_STAKING_NOMINATOR N
    EMIT CHANGES;
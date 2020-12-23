CREATE STREAM {APP_PREFIX}_STAKING_ERAS_DATA(
    "era" INT,
    "session_start" INT,
    "validators_active" INT,
    "nominators_active" INT,
    "total_reward" VARCHAR,
    "total_stake" VARCHAR,
    "total_reward_points" BIGINT
) WITH (
    kafka_topic = '{APP_PREFIX}_STAKING_ERAS_DATA',
    PARTITIONS = 1,
    VALUE_FORMAT = 'JSON',
    REPLICAS = 1
);

CREATE STREAM {APP_PREFIX}_STAKING_ERAS (
    "era" INT,
    "session_start" INT,
    "validators_active" INT,
    "nominators_active" INT,
    "total_reward" VARCHAR,
    "total_stake" VARCHAR,
    "total_reward_points" BIGINT
) WITH (
    KAFKA_TOPIC='{APP_PREFIX}_STAKING_ERAS',
    PARTITIONS=1,
    REPLICAS=1,
    VALUE_FORMAT='AVRO'
);

INSERT INTO {APP_PREFIX}_STAKING_ERAS SELECT E.*
FROM {APP_PREFIX}_STAKING_ERAS_DATA E
    EMIT CHANGES;
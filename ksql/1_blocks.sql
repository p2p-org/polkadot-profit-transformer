CREATE STREAM {APP_PREFIX}_BLOCK_DATA (
    "block" VARCHAR,
    "extrinsics" ARRAY < VARCHAR >,
    "events" ARRAY < VARCHAR >,
    "block_time" BIGINT
) WITH (
    kafka_topic = '{APP_PREFIX}_BLOCK_DATA',
    value_format = 'JSON'
);

CREATE STREAM {APP_PREFIX}_BLOCK (
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
    KAFKA_TOPIC='{APP_PREFIX}_BLOCK',
    PARTITIONS=1,
    REPLICAS=1,
    VALUE_FORMAT='AVRO'
);

INSERT INTO {APP_PREFIX}_BLOCK SELECT
                      CAST(EXTRACTJSONFIELD(B."block", '$.header.number') AS BIGINT) "id",
                      EXTRACTJSONFIELD(B."block", '$.header.hash') "hash",
                      EXTRACTJSONFIELD(B."block", '$.header.stateRoot') "state_root",
                      EXTRACTJSONFIELD(B."block", '$.header.extrinsicsRoot') "extrinsics_root",
                      EXTRACTJSONFIELD(B."block", '$.header.parentHash') "parent_hash",
                      EXTRACTJSONFIELD(B."block", '$.header.author') "author",
                      CAST(EXTRACTJSONFIELD(B."block", '$.header.session_id') AS INT) "session_id",
                      CAST(EXTRACTJSONFIELD(B."block", '$.header.era') AS INT) "era",
                      EXTRACTJSONFIELD(B."block", '$.header.last_log') "last_log",
                      EXTRACTJSONFIELD(B."block", '$.header.digest') "digest",
                      CAST((B."block_time" / 1000) AS BIGINT)   "block_time"
FROM {APP_PREFIX}_BLOCK_DATA B
    EMIT CHANGES;



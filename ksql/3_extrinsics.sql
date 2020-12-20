CREATE STREAM {APP_PREFIX}_extrinsic (
    "block_id" BIGINT,
    "extrinsic" STRING
) WITH (
    kafka_topic = '{APP_PREFIX}_EXTRINSIC',
    PARTITIONS = 1,
    VALUE_FORMAT = 'AVRO',
    REPLICAS = 1
);

INSERT INTO {APP_PREFIX}_extrinsic
SELECT
    CAST(extractjsonfield(B."block", '$.header.number') AS BIGINT) AS "block_id",
    EXPLODE(B."extrinsics") AS "extrinsic"

FROM {APP_PREFIX}_BLOCK_DATA B
    EMIT CHANGES;



CREATE STREAM {APP_PREFIX}_EXTRINSIC_EXTRACTION (
    "id" STRING,
    "block_id" BIGINT,
    "section" STRING,
    "method" STRING,
    "ref_event_ids" STRING,
    "extrinsic" STRING
) WITH (
    KAFKA_TOPIC='{APP_PREFIX}_EXTRINSIC_EXTRACTION',
    PARTITIONS=1,
    REPLICAS=1,
    VALUE_FORMAT='AVRO'
);

INSERT INTO {APP_PREFIX}_EXTRINSIC_EXTRACTION SELECT
                                     extractjsonfield(E."extrinsic", '$.id') "id",
                                     E."block_id" "block_id",
                                     extractjsonfield(E."extrinsic", '$.section') "section",
                                     extractjsonfield(E."extrinsic", '$.method') "method",
                                     extractjsonfield(E."extrinsic", '$.ref_event_ids') "ref_event_ids",
                                     extractjsonfield(E."extrinsic", '$.extrinsic')  "extrinsic"
FROM {APP_PREFIX}_EXTRINSIC E
    EMIT CHANGES;
CREATE STREAM {APP_PREFIX}_EXTRINSICS_DATA (
    "extrinsics" ARRAY < VARCHAR >
) WITH (
    kafka_topic = '{APP_PREFIX}_EXTRINSICS_DATA',
    PARTITIONS = 1,
    VALUE_FORMAT = 'JSON',
    REPLICAS = 1
);

CREATE STREAM {APP_PREFIX}_EXTRINSICS (
    "extrinsic" STRING
) WITH (
    kafka_topic = '{APP_PREFIX}_EXTRINSICS',
    PARTITIONS = 1,
    VALUE_FORMAT = 'AVRO',
    REPLICAS = 1
);

INSERT INTO {APP_PREFIX}_EXTRINSICS
SELECT
    EXPLODE(E."extrinsics") AS "extrinsic"
FROM {APP_PREFIX}_EXTRINSICS_DATA E
    EMIT CHANGES;


CREATE STREAM {APP_PREFIX}_EXTRINSIC_EXTRACTION (
    "id" VARCHAR,
    "block_id" BIGINT,
    "parent_id" VARCHAR,
    "session_id" INT,
    "era" INT,
    "section" VARCHAR,
    "method" VARCHAR,
    "mortal_period" INT,
    "mortal_phase" INT,
    "is_signed" BOOLEAN,
    "signer" VARCHAR,
    "tip" INT,
    "nonce" DOUBLE,
    "ref_event_ids" VARCHAR,
    "version" INT,
    "extrinsic" STRING,
    "args" STRING
) WITH (
    KAFKA_TOPIC='{APP_PREFIX}_EXTRINSIC_EXTRACTION',
    PARTITIONS=1,
    REPLICAS=1,
    VALUE_FORMAT='AVRO'
);

INSERT INTO {APP_PREFIX}_EXTRINSIC_EXTRACTION SELECT
    extractjsonfield(E."extrinsic", '$.id') "id",
    CAST(extractjsonfield(E."extrinsic", '$.block_id') AS BIGINT) "block_id",
    extractjsonfield(E."extrinsic", '$.parent_id') "parent_id",
    CAST(extractjsonfield(E."extrinsic", '$.session_id') AS INT) "session_id",
    CAST(extractjsonfield(E."extrinsic", '$.era') AS INT) "era",
    extractjsonfield(E."extrinsic", '$.section') "section",
    extractjsonfield(E."extrinsic", '$.method') "method",
    CAST(extractjsonfield(E."extrinsic", '$.mortal_period') AS INT) "mortal_period",
    CAST(extractjsonfield(E."extrinsic", '$.mortal_phase') AS INT) "mortal_phase",
    CAST(extractjsonfield(E."extrinsic", '$.is_signed') AS BOOLEAN) "is_signed",
    extractjsonfield(E."extrinsic", '$.signer') "signer",
    CAST(extractjsonfield(E."extrinsic", '$.tip') AS INT) "tip",
    CAST(extractjsonfield(E."extrinsic", '$.nonce') AS DOUBLE) "nonce",
    extractjsonfield(E."extrinsic", '$.ref_event_ids') "ref_event_ids",
    CAST(extractjsonfield(E."extrinsic", '$.version') AS INT) "version",
    extractjsonfield(E."extrinsic", '$.extrinsic') "extrinsic",
    extractjsonfield(E."extrinsic", '$.args') "args"
FROM {APP_PREFIX}_EXTRINSICS E
   EMIT CHANGES;


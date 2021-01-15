CREATE TYPE EXTRINSIC AS STRUCT<
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
>;

CREATE STREAM {APP_PREFIX}_EXTRINSICS_DATA(
    extrinsics ARRAY <EXTRINSIC>
) WITH (
    kafka_topic = '{APP_PREFIX}_EXTRINSICS_DATA',
    PARTITIONS = 1,
    VALUE_FORMAT = 'JSON',
    REPLICAS = 1
);


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

-- INSERT INTO {APP_PREFIX}_EXTRINSIC_EXTRACTION SELECT
--     EXPLODE(E."extrinsics")
-- FROM {APP_PREFIX}_EXTRINSICS_DATA E
--    EMIT CHANGES;

INSERT INTO SUBSTRATE_STREAMER_DEV_POLKADOT_EXTRINSIC_EXTRACTION SELECT
    EXPLODE(E.extrinsics)
FROM SUBSTRATE_STREAMER_DEV_POLKADOT_EXTRINSICS_DATA E
    EMIT CHANGES;
CREATE STREAM {APP_PREFIX}_IDENTITY_ENRICHMENT_DATA(
    "account_id" VARCHAR,
    "root_account_id" VARCHAR,
    "display" VARCHAR,
    "legal" VARCHAR,
    "riot" VARCHAR,
    "email" VARCHAR,
    "twitter" VARCHAR,
    "created_at" BIGINT,
    "killed_at" BIGINT
) WITH (
    kafka_topic = '{APP_PREFIX}_IDENTITY_ENRICHMENT_DATA',
    PARTITIONS = 1,
    VALUE_FORMAT = 'JSON',
    REPLICAS = 1
);

CREATE STREAM {APP_PREFIX}_IDENTITY_ENRICHMENT (
    "account_id" VARCHAR,
    "root_account_id" VARCHAR,
    "display" VARCHAR,
    "legal" VARCHAR,
    "riot" VARCHAR,
    "email" VARCHAR,
    "twitter" VARCHAR,
    "created_at" BIGINT,
    "killed_at" BIGINT
) WITH (
    KAFKA_TOPIC='{APP_PREFIX}_IDENTITY_ENRICHMENT',
    PARTITIONS=1,
    REPLICAS=1,
    VALUE_FORMAT='AVRO'
);

INSERT INTO {APP_PREFIX}_IDENTITY_ENRICHMENT SELECT E.*
FROM {APP_PREFIX}_IDENTITY_ENRICHMENT_DATA E
    EMIT CHANGES;
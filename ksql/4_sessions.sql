

CREATE STREAM {APP_PREFIX}_SESSION_DATA (
    "session_id" INT,
    "era" INT,
    "block_end" BIGINT,
    "validators" ARRAY < VARCHAR >,
    "nominators" ARRAY < VARCHAR >,
    "eras" VARCHAR,
    "block_time" BIGINT
) WITH (
    kafka_topic = '{APP_PREFIX}_SESSION_DATA',
    value_format = 'JSON'
);

CREATE STREAM {APP_PREFIX}_SESSION_END (
    "id" INT,
    "era" INT,
    "block_end" BIGINT,
    "block_time" BIGINT
) WITH (
    KAFKA_TOPIC='{APP_PREFIX}_SESSION_END',
    PARTITIONS=1,
    REPLICAS=1,
    VALUE_FORMAT='AVRO'
);

INSERT INTO {APP_PREFIX}_SESSION_END SELECT
                            S."session_id" "id",
                            S."era" "era",
                            S."block_end" "block_end",
                            (S."block_time" / 1000) "block_time"
FROM {APP_PREFIX}_SESSION_DATA S
    EMIT CHANGES;
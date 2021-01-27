CREATE STREAM {APP_PREFIX}_event (
    "block_id" BIGINT,
    "session_id" INT,
    "era" INT,
    "event" STRING
) WITH (
    kafka_topic = '{APP_PREFIX}_EVENT',
    PARTITIONS = 1,
    VALUE_FORMAT = 'AVRO',
    REPLICAS = 1
);

INSERT INTO {APP_PREFIX}_event
SELECT
    CAST(extractjsonfield(B."block", '$.header.number') AS BIGINT) AS "block_id",
    CAST(EXTRACTJSONFIELD(B."block", '$.header.session_id') AS INT) "session_id",
    CAST(EXTRACTJSONFIELD(B."block", '$.header.era') AS INT) "era",
    EXPLODE(B."events") AS "event"

FROM {APP_PREFIX}_BLOCK_DATA B
    EMIT CHANGES;


CREATE STREAM {APP_PREFIX}_EVENT_EXTRACTION (
    "id" STRING,
    "block_id" BIGINT,
    "session_id" INT,
    "era" INT,
    "section" STRING,
    "method" STRING,
    "data" STRING,
    "event" STRING
) WITH (
    KAFKA_TOPIC='{APP_PREFIX}_EVENT_EXTRACTION',
    PARTITIONS=1,
    REPLICAS=1,
    VALUE_FORMAT='AVRO'
);

INSERT INTO {APP_PREFIX}_EVENT_EXTRACTION SELECT
                                 extractjsonfield(E."event", '$.id') "id",
                                 E."block_id" "block_id",
                                 E."session_id" "session_id",
                                 E."era" "era",
                                 extractjsonfield(E."event", '$.section') "section",
                                 extractjsonfield(E."event", '$.method') "method",
                                 extractjsonfield(E."event", '$.data') "data",
                                 extractjsonfield(E."event", '$.event') "event"
FROM {APP_PREFIX}_EVENT E
    EMIT CHANGES;
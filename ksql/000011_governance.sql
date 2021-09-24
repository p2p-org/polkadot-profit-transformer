CREATE STREAM {APP_PREFIX}_GOVERNANCE_DATA ( 
    "event_id" STRING,
    "data" STRING,
    "block_id" BIGINT,
    "method" STRING,
    "section" STRING
) WITH (
    KAFKA_TOPIC='{APP_PREFIX}_GOVERNANCE_DATA',
    PARTITIONS=1,
    REPLICAS=1,
    VALUE_FORMAT='JSON'
);

INSERT INTO {APP_PREFIX}_GOVERNANCE_DATA SELECT
                                            extractjsonfield(E."event", '$.id') "event_id",
                                            extractjsonfield(E."event", '$.data') "data",
                                            E."block_id" "block_id",
                                            extractjsonfield(E."event", '$.method') "method",
                                            extractjsonfield(E."event", '$.section') "section"

FROM {APP_PREFIX}_EVENT E
WHERE
    (
        extractjsonfield(E."event", '$.section') = 'technicalCommittee' 
        OR
        extractjsonfield(E."event", '$.section') = 'democracy'
        OR
        extractjsonfield(E."event", '$.section') = 'council'
        OR 
        extractjsonfield(E."event", '$.section') = 'treasury'
        OR
        extractjsonfield(E."event", '$.section') = 'tips'
    ) 
    EMIT CHANGES;
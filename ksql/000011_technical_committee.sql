CREATE STREAM {APP_PREFIX}_TECHICAL_COMMITTEE_DATA (
    "event_id" STRING,
    "event" STRING,
    "data" STRING,
    "block_id" BIGINT,
    "method" STRING
) WITH (
    KAFKA_TOPIC='{APP_PREFIX}_TECHICAL_COMMITTEE_DATA',
    PARTITIONS=1,
    REPLICAS=1,
    VALUE_FORMAT='JSON'
);

INSERT INTO {APP_PREFIX}_TECHICAL_COMMITTEE_DATA SELECT
                                            extractjsonfield(E."event", '$.id') "event_id",
                                            extractjsonfield(E."event", '$.method') "event",
                                            extractjsonfield(E."event", '$.data') "data",
                                            E."block_id" "block_id"
                                            E."method" "method"
FROM {APP_PREFIX}_EVENT E
WHERE
    (
        extractjsonfield(E."event", '$.section') = 'technicalCommittee'
    ) 
    EMIT CHANGES;
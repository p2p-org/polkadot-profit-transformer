CREATE STREAM {APP_PREFIX}_ENRICHMENT_ACCOUNT_DATA (
    "event_id" STRING,
    "account_id" STRING,
    "event" STRING,
    "data" STRING,
    "block_id" BIGINT
) WITH (
    KAFKA_TOPIC='{APP_PREFIX}_ENRICHMENT_ACCOUNT_DATA',
    PARTITIONS=1,
    REPLICAS=1,
    VALUE_FORMAT='JSON'
);

INSERT INTO {APP_PREFIX}_ENRICHMENT_ACCOUNT_DATA SELECT
                                            extractjsonfield(E."event", '$.id') "event_id",
                                            extractjsonfield(E."event", '$.data[0].AccountId') "account_id",
                                            extractjsonfield(E."event", '$.method') "event",
                                            extractjsonfield(E."event", '$.data') "data",
                                            E."block_id" "block_id"
FROM {APP_PREFIX}_EVENT E
WHERE
    (
        extractjsonfield(E."event", '$.section') = 'system' OR 
        extractjsonfield(E."event", '$.section') = 'identity'
    ) 
    AND 
    (
        extractjsonfield(E."event", '$.method') = 'NewAccount' OR
        extractjsonfield(E."event", '$.method') = 'KilledAccount' OR 
        extractjsonfield(E."event", '$.method') = 'JudgementGiven' OR
        extractjsonfield(E."event", '$.method') = 'JudgementRequested' OR
        extractjsonfield(E."event", '$.method') = 'JudgementUnrequested'
    )
    EMIT CHANGES;
#!/bin/bash
docker-compose up -d zookeeper broker

docker-compose exec broker kafka-topics --create --bootstrap-server localhost:9092 --replication-factor 1 --partitions 1 --topic block_data

docker-compose up -d --build schema-registry connect control-center ksqldb-server ksqldb-cli ksql-datagen rest-proxy db

echo "Starting ksql containers..."
sleep 3m # we should wait a little bit

# create streams
curl -X "POST" "http://localhost:8088/ksql" \
     -H "Content-Type: application/vnd.ksql.v1+json; charset=utf-8" \
     -d $'{
  "ksql": "CREATE STREAM block_data (block VARCHAR, extrinsics ARRAY<VARCHAR>, events ARRAY<VARCHAR>) WITH (kafka_topic=\'block_data\', value_format=\'JSON\'); create stream block with (PARTITIONS=1, VALUE_FORMAT=\'AVRO\') as select cast(extractjsonfield(block, \'$.header.number\') as integer) as number, extractjsonfield(block, \'$.header.hash\') as hash, extractjsonfield(block, \'$.header.stateRoot\') as state_root, extractjsonfield(block, \'$.header.extrinsicsRoot\') as extrinsics_root, extractjsonfield(block, \'$.header.parentHash\') as parent_hash, extractjsonfield(block, \'$.header.digest\') as digest, CAST(EXTRACTJSONFIELD(BLOCK_DATA.EXTRINSICS[1], \'$.method.args.now\') as bigint) AS create_time from BLOCK_DATA EMIT CHANGES; create stream extrinsic with (PARTITIONS=1, VALUE_FORMAT=\'AVRO\') as SELECT cast(extractjsonfield(block, \'$.header.number\') as integer) as block_number, explode(extrinsics) as extrinsic from block_data EMIT CHANGES; create stream event with (PARTITIONS=1, VALUE_FORMAT=\'AVRO\') as SELECT cast(extractjsonfield(block, \'$.header.number\') as integer) as block_number, explode(events) as event from block_data EMIT CHANGES; CREATE TABLE profit_events_filter_rules (method varchar(30)) WITH (KAFKA_TOPIC=\'profit_events_filter_rules\', VALUE_FORMAT=\'JSON\', KEY=\'METHOD\', PARTITIONS=1); INSERT INTO profit_events_filter_rules (method) VALUES (\'Reward\'); INSERT INTO profit_events_filter_rules (method) VALUES (\'Deposit\'); CREATE STREAM profit_events_filter as select E.block_number, E.event from EVENT E INNER JOIN PROFIT_EVENTS_FILTER_RULES P ON extractjsonfield(E.event, \'$.method\')=P.method WHERE extractjsonfield(E.event, \'$.section\') != \'treasury\'; CREATE STREAM balances as select BLOCK_NUMBER, BLOCK.create_time as create_time, extractjsonfield(event, \'$.method\') as method, extractjsonfield(event, \'$.data.AccountId\') as account_id, cast(extractjsonfield(event, \'$.data.Balance\') as bigint) as balance from PROFIT_EVENTS_FILTER INNER JOIN BLOCK WITHIN 5 HOURS ON BLOCK.NUMBER=BLOCK_NUMBER;CREATE STREAM BALANCES_WITH_IS_VALIDATOR WITH (KAFKA_TOPIC=\'BALANCES_WITH_IS_VALIDATOR\', PARTITIONS=1, REPLICAS=1) AS SELECT BALANCES.BLOCK_NUMBER BLOCK_NUMBER, BALANCES.ACCOUNT_ID ACCOUNT_ID, BALANCES.BALANCE BALANCE, BALANCES.METHOD METHOD, IS_VALIDATOR(CAST(BLOCK_DATA.EXTRINSICS AS STRING), BALANCES.ACCOUNT_ID) IS_VALIDATOR, BALANCES.CREATE_TIME CREATE_TIME FROM BALANCES BALANCES LEFT OUTER JOIN BLOCK_DATA BLOCK_DATA WITHIN 10000000 DAYS ON ((BALANCES.BLOCK_NUMBER = CAST(EXTRACTJSONFIELD(BLOCK_DATA.BLOCK, \'$.header.number\') AS INTEGER))) EMIT CHANGES;",
  "streamsProperties": {}
}'

curl -X "POST" -H "Accept:application/json" -H "Content-Type: application/json" --data @connectors/block_sink.json http://localhost:8083/connectors
curl -X "POST" -H "Accept:application/json" -H "Content-Type: application/json" --data @connectors/event_sink.json http://localhost:8083/connectors
curl -X "POST" -H "Accept:application/json" -H "Content-Type: application/json" --data @connectors/extrinsic_sink.json http://localhost:8083/connectors
curl -X "POST" -H "Accept:application/json" -H "Content-Type: application/json" --data @connectors/balances_sink.json http://localhost:8083/connectors

docker-compose up -d --build streamer identity_enrichment
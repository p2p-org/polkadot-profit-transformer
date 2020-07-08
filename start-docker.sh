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
  "ksql": "CREATE STREAM block_data (block VARCHAR, extrinsics ARRAY<VARCHAR>, events ARRAY<VARCHAR>) WITH (kafka_topic=\'block_data\', value_format=\'JSON\'); create stream block with (PARTITIONS=1, VALUE_FORMAT=\'AVRO\') as select cast(extractjsonfield(block, \'$.header.number\') as integer) as number, extractjsonfield(block, \'$.header.hash\') as hash, extractjsonfield(block, \'$.header.stateRoot\') as state_root, extractjsonfield(block, \'$.header.extrinsicsRoot\') as extrinsics_root, extractjsonfield(block, \'$.header.parentHash\') as parent_hash, extractjsonfield(block, \'$.header.digest\') as digest from BLOCK_DATA EMIT CHANGES; create stream extrinsic with (PARTITIONS=1, VALUE_FORMAT=\'AVRO\') as SELECT cast(extractjsonfield(block, \'$.header.number\') as integer) as block_number, explode(extrinsics) as extrinsic from block_data EMIT CHANGES; create stream event with (PARTITIONS=1, VALUE_FORMAT=\'AVRO\') as SELECT cast(extractjsonfield(block, \'$.header.number\') as integer) as block_number, explode(events) as event from block_data EMIT CHANGES;",
  "streamsProperties": {}
}'

curl -X "POST" -H "Accept:application/json" -H "Content-Type: application/json" --data @connectors/block_sink.json http://localhost:8083/connectors
curl -X "POST" -H "Accept:application/json" -H "Content-Type: application/json" --data @connectors/event_sink.json http://localhost:8083/connectors
curl -X "POST" -H "Accept:application/json" -H "Content-Type: application/json" --data @connectors/extrinsic_sink.json http://localhost:8083/connectors

docker-compose up -d --build streamer
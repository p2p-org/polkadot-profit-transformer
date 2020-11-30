#!/bin/bash
docker-compose up -d zookeeper broker

docker-compose exec broker kafka-topics --create --bootstrap-server localhost:9092 --replication-factor 1 --partitions 1 --topic block_data

docker-compose exec broker kafka-topics --create --bootstrap-server localhost:9092 --replication-factor 1 --partitions 1 --topic session_data

docker-compose exec broker kafka-topics --create --bootstrap-server localhost:9092 --replication-factor 1 --partitions 1 --topic validators_data

docker-compose exec broker kafka-topics --create --bootstrap-server localhost:9092 --replication-factor 1 --partitions 1 --topic nominators_data

docker-compose exec broker kafka-topics --create --bootstrap-server localhost:9092 --replication-factor 1 --partitions 1 --topic identity_enrichment_sink

docker-compose up -d --build schema-registry connect control-center ksqldb-server ksqldb-cli ksql-datagen rest-proxy db

echo "Starting ksql containers..."
sleep 4m # we should wait a little bit

# create streams
curl -X "POST" "http://localhost:8088/ksql" \
     -H "Content-Type: application/vnd.ksql.v1+json; charset=utf-8" \
     --data @transformer_queries_init.json

curl -X "POST" -H "Accept:application/json" -H "Content-Type: application/json" --data @connectors/block_sink.json http://localhost:8083/connectors
curl -X "POST" -H "Accept:application/json" -H "Content-Type: application/json" --data @connectors/event_extraction_sink.json http://localhost:8083/connectors
curl -X "POST" -H "Accept:application/json" -H "Content-Type: application/json" --data @connectors/extrinsic_extraction_sink.json http://localhost:8083/connectors
curl -X "POST" -H "Accept:application/json" -H "Content-Type: application/json" --data @connectors/balances_sink.json http://localhost:8083/connectors
curl -X "POST" -H "Accept:application/json" -H "Content-Type: application/json" --data @connectors/sessions_extraction_sink.json http://localhost:8083/connectors
curl -X "POST" -H "Accept:application/json" -H "Content-Type: application/json" --data @connectors/validators_extraction_sink.json http://localhost:8083/connectors
curl -X "POST" -H "Accept:application/json" -H "Content-Type: application/json" --data @connectors/nominators_extraction_sink.json http://localhost:8083/connectors
curl -X "POST" -H "Accept:application/json" -H "Content-Type: application/json" --data @connectors/identity_enrichment_sink.json http://localhost:8083/connectors

docker-compose up -d --build streamer enrichments_processor
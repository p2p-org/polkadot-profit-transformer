#!/bin/bash

# Init colors
COLOR_RED=$(tput setaf 1)
COLOR_GREEN=$(tput setaf 2)
COLOR_NONE=$(tput sgr0)

# Check dependencies
if ! type "docker" >/dev/null; then
  echo "${COLOR_RED}The \"docker\" not found${COLOR_NONE}"
  exit 1
fi

if ! type "docker-compose" >/dev/null; then
  echo "${COLOR_RED}The \"docker-compose\" command not found${COLOR_NONE}"
  exit 1
fi

if ! type "jq" >/dev/null; then
  echo "${COLOR_RED}The \"jq\" command not found${COLOR_NONE}"
  exit 1
fi

while getopts e:c: flag
do
    case "${flag}" in
        e) FLAG_ENV_FILE_PATH=${OPTARG};;
        c) FLAG_COMMAND=${OPTARG};;
    esac
done

# Check .env files
# If not exist, environment variables should be initialized

CONFIG_SCRIPT_ENV_FILE='.polkadot.mbelt.env'
if [ -z "$FLAG_ENV_FILE_PATH" ]; then
  if [ ! -s "$CONFIG_SCRIPT_ENV_FILE" ]; then
    echo "${COLOR_RED}Default .env file not found \"$CONFIG_SCRIPT_ENV_FILE\", use -e flag for define${COLOR_NONE}"
    exit 1
  fi
else
  if [ ! -s "$FLAG_ENV_FILE_PATH" ]; then
    echo "${COLOR_RED}Defined .env file not found \"$FLAG_ENV_FILE_PATH\"${COLOR_NONE}"
    CONFIG_SCRIPT_ENV_FILE=''
    exit 1
  fi
  CONFIG_SCRIPT_ENV_FILE=$FLAG_ENV_FILE_PATH
fi

# Load .env file
if [ -n "$2" ]; then
  set -o allexport
  eval $(cat "$CONFIG_SCRIPT_ENV_FILE" | sed -e '/^#/d;/^\s*$/d' -e 's/\(\w*\)[ \t]*=[ \t]*\(.*\)/\1=\2/' -e "s/=['\"]\(.*\)['\"]/=\1/g" -e "s/'/'\\\''/g" -e "s/=\(.*\)/='\1'/g")
  set +o allexport
  echo "${COLOR_GREEN}Loaded environment variables from .env file \"$2\"${COLOR_NONE}"
fi

KAFKA_REST_PROXY_URL="http://${KAFKA_HOST}:8082"
KAFKA_CLUSTER_ID=$(curl -sX GET "$KAFKA_REST_PROXY_URL/v3/clusters" -H "Content-Type: application/json" |  jq -r '.data[0].cluster_id')

if [ -z "$KAFKA_HOST" ]; then
  echo "${COLOR_RED}KAFKA_HOST is not defined${COLOR_NONE}"
  exit 1
fi

if [ -z "$POSTGRES_HOST" ]; then
  echo "${COLOR_RED}POSTGRES_HOST is not defined${COLOR_NONE}"
  exit 1
fi

if [ -z "$POSTGRES_DB" ]; then
  echo "${COLOR_RED}POSTGRES_DB is not defined${COLOR_NONE}"
  exit 1
fi

if [ -z "$POSTGRES_SCHEMA" ]; then
  echo "${COLOR_RED}POSTGRES_SCHEMA is not defined, using default value \"postgres\"${COLOR_NONE}"
  exit 1
fi

if [ -z "$POSTGRES_PASSWORD" ]; then
  echo "${COLOR_RED}POSTGRES_PASSWORD is not defined${COLOR_NONE}"
  exit 1
fi


DIR_KSQL_INIT_CONFIG='./ksql'
FILE_KSQL_CONFIG='./ksql_config.json'
KAFKA_REST_PROXY_URL="http://${KAFKA_HOST}:8082"
KAFKA_CONNECT_URL="http://${KAFKA_HOST}:8083"
KAFKA_SCHEMA_URL="http://${KAFKA_HOST}:8081"
KAFKA_KSQL_DB_URL="http://${KAFKA_HOST}:8088"

if [ -z "$POSTGRES_PORT" ]; then
  echo "POSTGRES_PORT is not defined, using default value \"5432\""
  POSTGRES_PORT=5432
fi

if [ -z "$POSTGRES_USER" ]; then
  echo "POSTGRES_USER is not defined, using default value \"postgres\""
  POSTGRES_USER='posgres'
fi

DATASTORE_JDBC_CONNECTION_URL="jdbc:postgresql://${POSTGRES_HOST}:${POSTGRES_PORT}/${POSTGRES_DB}?user=${POSTGRES_USER}&password=${POSTGRES_PASSWORD}"

if [ -z "$APP_MODE" ]; then
  echo "${COLOR_RED}APP_MODE is not defined. Example: \"dev\", \"prod\", \"test\"${COLOR_NONE}"
  exit 1
fi

if [ -z "$APP_NETWORK" ]; then
  echo "${COLOR_RED}APP_NETWORK is not defined. Example: \"polkadot\", \"kusama\", \"cosmos\", etc{COLOR_NONE}"
  exit 1
fi

if [ -z "$APP_ID" ]; then
  echo "${COLOR_RED}APP_NETWORK is not defined. Example: \"cosmos_streamer\", \"substrate_streamer\", \"filecoin_streamer\", etc{COLOR_NONE}"
  exit 1
fi

APP_PREFIX=$(echo "$APP_ID"_"$APP_MODE"_"$APP_NETWORK" | tr '[:lower:]' '[:upper:]')

# {
#  "ksql": "",
#  "streamsProperties": {}
# }

read -r -d '' KSQL_FILE_TEMPLATE <<-EOM
{
  "ksql": {KSQL},
  "streamsProperties": {}
}
EOM

echo "${COLOR_GREEN}Starting ksql containers...${COLOR_NONE}"

KAFKA_API_ATTEMPT_COUNTER=0
KAFKA_API_ATTEMPTS=600

echo "Waiting for kafka broker..."

while [[ "$(curl -sX GET "$KAFKA_REST_PROXY_URL/brokers" \
  -H "Content-Type: application/json" | jq -r '.brokers[0]')" = null ]]; do
    if [ ${KAFKA_API_ATTEMPTS} -eq ${KAFKA_API_ATTEMPT_COUNTER} ];then
      echo "${COLOR_RED}Cannot connect to Kafka API instance. Max attempts reached${COLOR_NONE}"
      exit 1
    fi

    printf '.'
    KAFKA_API_ATTEMPT_COUNTER=$((KAFKA_API_ATTEMPT_COUNTER+1))
    sleep 1
done

if [ ! -s $FILE_KSQL_CONFIG ]
then
  echo "${COLOR_RED}KSQL config not found \"$FILE_KSQL_CONFIG\"${COLOR_NONE}"
  exit
fi

KSQL_CONFIG+=$(<"$FILE_KSQL_CONFIG")

if [[ $(jq -r '.topics[0]' <<<"$KSQL_CONFIG") == null ]]; then
  echo "${COLOR_RED}KSQL config \"$FILE_KSQL_CONFIG\" doesn't contains \"topic\" entries${COLOR_NONE}"
  exit
fi

for kafka_topic in $(jq -r '.topics[].name' <<<"$KSQL_CONFIG"); do
  kafka_topic="$APP_PREFIX"_"$kafka_topic"
    if [[ $(curl -sX GET "$KAFKA_REST_PROXY_URL/v3/clusters/$KAFKA_CLUSTER_ID/topics" \
      -H "Content-Type: application/json" | \
      jq -r ". | select( any(.data[]; .topic_name == \"$kafka_topic\"))") ]]; then
      echo "Topic \"$kafka_topic\" already exists"
    else
      KAFKA_REST_RESP_MESSAGE=$(curl -sX POST "$KAFKA_REST_PROXY_URL/v3/clusters/$KAFKA_CLUSTER_ID/topics" \
        -H "Content-Type: application/json" \
        --data "{\"topic_name\": \"$kafka_topic\", \"partitions_count\": 1, \"replication_factor\": 1, \"configs\": [{\"name\": \"cleanup.policy\",\"value\": \"delete\"}, {\"name\": \"retention.ms\",\"value\": \"432000000\"}]}" | \
        jq '.message')

        if [[ "$KAFKA_REST_RESP_MESSAGE" != null ]]; then
          echo "${COLOR_RED}$KAFKA_REST_RESP_MESSAGE${COLOR_NONE}"
        fi
    fi
done

KSQL_ATTEMPT_COUNTER=0
KSQL_MAX_ATTEMPTS=600

echo "Waiting for KSQL server..."

while [[ "$(curl -sX GET "$KAFKA_KSQL_DB_URL/info" | jq -r '.KsqlServerInfo')" = null ]]; do
    if [ ${KSQL_ATTEMPT_COUNTER} -eq ${KSQL_MAX_ATTEMPTS} ];then
      echo "Cannot connect to KSQL instance. Max attempts reached"
      exit 1
    fi

    printf '.'
    KSQL_ATTEMPT_COUNTER=$((KSQL_ATTEMPT_COUNTER+1))
    sleep 1
done

KSQL_SERVER_VERSION=$(curl -sX GET "$KAFKA_KSQL_DB_URL/info" | jq -r '.KsqlServerInfo.version')
echo "KSQL server is ready. Version \"$KSQL_SERVER_VERSION\""


if [ ! -d $DIR_KSQL_INIT_CONFIG ]; then
  echo "${COLOR_RED}KSQL migrations dir \"$DIR_KSQL_INIT_CONFIG\" not exists${COLOR_NONE}"
  exit 1
fi

if [ -z "$(ls -A $DIR_KSQL_INIT_CONFIG/*.sql)" ]; then
  echo "${COLOR_RED}KSQL migrations dir \"$DIR_KSQL_INIT_CONFIG\" does not contains *.sql files${COLOR_NONE}"
  exit 1
fi

for file in "$DIR_KSQL_INIT_CONFIG"/*.sql; do
  echo "$Loading KSQL migrations \"$file\""
  GEN_KSQL=$(<"$file")

  if [ -z "$GEN_KSQL" ]; then
    echo "${COLOR_RED}Loaded KSQL migrations file is empty${COLOR_NONE}"
    echo "${COLOR_RED}Please, check \"$file\"${COLOR_NONE}"
    continue
  fi

  # TODO: Use params array
  for param in {APP_ID,APP_MODE,APP_NETWORK,APP_PREFIX}; do
    GEN_KSQL=${GEN_KSQL//\{$param\}/${!param}}
  done

  GEN_KSQL=$(echo "$GEN_KSQL" | jq -Rs)
  KSQL_INIT="${KSQL_FILE_TEMPLATE//\{KSQL\}/$GEN_KSQL}"

  KSQL_RESP_MESSAGE=$(curl -sX "POST" "$KAFKA_KSQL_DB_URL/ksql" \
    -H "Content-Type: application/vnd.ksql.v1+json; charset=utf-8" \
    --data "$KSQL_INIT" | jq '. | if type == "array" then null else .message end')

  if [[ "$KSQL_RESP_MESSAGE" != null ]]; then
    echo "${COLOR_RED}$KSQL_RESP_MESSAGE${COLOR_NONE}"
  fi
done

#{
#  "name": "",
#  "config": {
#    "connector.class": "io.confluent.connect.jdbc.JdbcSinkConnector",
#    "key.converter": "org.apache.kafka.connect.storage.StringConverter",
#    "value.converter": "io.confluent.connect.avro.AvroConverter",
#    "topics": "BLOCK",
#    "connection.url": "jdbc:postgresql://db:5432/raw?user=sink&password=d5_TDyp52HhMceA82sv0u_30wLX2o1_j520p8x",
#    "dialect.name": "PostgreSqlDatabaseDialect",
#    "insert.mode": "",
#    "table.name.format": "",
#    "pk.mode": "",
#    "auto.create": false,
#    "auto.evolve": false,
#    "value.converter.schema.registry.url": "http://schema-registry:8081"
#  }
#}

read -r -d '' KAFKA_FILE_CONNECTOR_TEMPLATE <<-EOM
{
  "name": "",
  "config": {
    "connector.class": "io.confluent.connect.jdbc.JdbcSinkConnector",
    "key.converter": "org.apache.kafka.connect.storage.StringConverter",
    "value.converter": "io.confluent.connect.avro.AvroConverter",
    "topics": "BLOCK",
    "connection.url": "",
    "dialect.name": "PostgreSqlDatabaseDialect",
    "insert.mode": "",
    "table.name.format": "",
    "pk.mode": "",
    "auto.create": false,
    "auto.evolve": false,
    "value.converter.schema.registry.url": ""
  }
}
EOM

for kafka_connector in $(jq -c '.connectors[]' <<<"$KSQL_CONFIG"); do
  for param in {APP_ID,APP_MODE,APP_NETWORK,APP_PREFIX,POSTGRES_SCHEMA}; do
    kafka_connector=${kafka_connector//\{$param\}/${!param}}
  done
  # Merge config with template
  KAFKA_CONNECTOR_CONFIG=$(echo "$KAFKA_FILE_CONNECTOR_TEMPLATE" "$kafka_connector" | jq -s '.[0] * .[1]')

  # Fill up variables
  KAFKA_CONNECTOR_CONFIG=$(echo "$KAFKA_CONNECTOR_CONFIG" | jq --arg DATASTORE_JDBC_CONNECTION_URL "$DATASTORE_JDBC_CONNECTION_URL" '.config["connection.url"] = $DATASTORE_JDBC_CONNECTION_URL')
  KAFKA_CONNECTOR_CONFIG=$(echo "$KAFKA_CONNECTOR_CONFIG" | jq --arg KAFKA_SCHEMA_URL "$KAFKA_SCHEMA_URL" '.config["value.converter.schema.registry.url"] = $KAFKA_SCHEMA_URL')


  echo "Creating connector $(echo "$KAFKA_CONNECTOR_CONFIG" | jq '.name')"
  KAFKA_CONNECT_RESP_MESSAGE=$(curl -sX "POST" "$KAFKA_CONNECT_URL"/connectors \
    -H "Accept:application/json" -H "Content-Type: application/json" \
    --data "$KAFKA_CONNECTOR_CONFIG" | jq '.message')

  if [[ "$KAFKA_CONNECT_RESP_MESSAGE" != null ]]; then
    echo "${COLOR_RED}$KAFKA_CONNECT_RESP_MESSAGE${COLOR_NONE}"
  fi
done

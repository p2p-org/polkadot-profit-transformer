#!/bin/bash

DIR_KSQL_INIT_CONFIG='./ksql/migrations'
KAFKA_KSQL_DB_URL='http://localhost:8088'

APP_MODE=dev
APP_NETWORK=polkadot

APP_ID=substrate_streamer
APP_PREFIX=$(echo "$APP_ID"_"$APP_MODE"_"$APP_NETWORK" | tr '[:lower:]' '[:upper:]')


COLOR_RED=$(tput setaf 1)
COLOR_GREEN=$(tput setaf 2)
COLOR_NONE=$(tput sgr0)

read -r -d '' KSQL_FILE_TEMPLATE <<-EOM
{
  "ksql": {KSQL},
  "streamsProperties": {}
}
EOM




for file in "$DIR_KSQL_INIT_CONFIG"/*.sql; do
  echo "Loading KSQL migrations \"$file\""
  GEN_KSQL=$(<"$file")


  # TODO: Use params array
  for param in {APP_ID,APP_MODE,APP_NETWORK,APP_PREFIX}; do
    GEN_KSQL=${GEN_KSQL//\{$param\}/${!param}}
  done



  GEN_KSQL=$(echo "$GEN_KSQL" | jq -Rs .)
  KSQL_INIT="${KSQL_FILE_TEMPLATE//\{KSQL\}/$GEN_KSQL}"


  KSQL_RESP_MESSAGE=$(curl -sX "POST" "$KAFKA_KSQL_DB_URL/ksql" \
    -H "Content-Type: application/vnd.ksql.v1+json; charset=utf-8" \
    --data "$KSQL_INIT" | jq '. | if type == "array" then null else .message end')

  if [[ "$KSQL_RESP_MESSAGE" != null ]]; then
    echo "${COLOR_RED}$KSQL_RESP_MESSAGE${COLOR_NONE}"
  fi
done

echo 'migration complete'


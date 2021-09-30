#!/bin/bash

DB_CONNECTION_URL='jdbc:postgresql://db:5432/raw?user=sink&password=d5_TDyp52HhMceA82sv0u_30wLX2o1_j520p8x'
POSTGRES_SCHEMA='dot_polka'
REDASH_HOST='localhost:5000'

APP_MODE=dev
APP_NETWORK=polkadot

APP_ID=substrate_streamer


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

make docker.createnetwork

docker-compose -f docker-compose.yml db


# docker-compose -f docker-compose.yml -f docker-compose.ksql.yml -f docker-compose.graphql.yml up -d graphile
# docker-compose -f docker-compose.yml -f docker-compose.ksql.yml -f docker-compose.graphql.yml up -d streamer enrichments_processor

# echo "Setting up Redash"

# make redash.init

# echo "Redash is up and running: http://localhost:5000"

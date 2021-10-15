#!/bin/bash


COLOR_RED=$(tput setaf 1)
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

docker-compose -f docker-compose.yml up -d db hasura streamer


echo "Setting up Redash"

make redash.init

echo "Redash is up and running: http://localhost:5000"

# MBELT draft

# Introduction

Multi blockchain ETL solution is an interoperability-first data warehouse with graphQL API capable to provide application-specific data, designed to reduce cost as well as simplify the process of building wallets, dashboards, explorers and apps that interact with multiple blockchains connected through an interchain communication protocol.

# Features

- Support extract and store data from Polkadot Relay chain and Kusama
- Built-in default GraphQL API
- Support UI for GraphQL, based on PostGraphile
- Docker-compose setup for easy deployment of the ETL and API solution
- Auto configuration tools for Kafka, KSQL based on unified config
- Materialised views for Postgresql
- Built-in dashboards for vendor Redash integration

# Dependencies

- Docker (allocate memory at least 8 GB in docker settings)
- Docker Compose
- Make (optional)
- Python

# Ram requirements

- streamer: 2Gb
- enrichments_processor: 512Mb
- KSQL cluster: 12Gb
- Postgresql: 1Gb

_For launching all stack on a single machine, 16Gb RAM and 30Gb disk space for polkadot, 100Gb for kusama required._

You need Polkadot or Kusama node **in archive mode** with an open websocket interface.



Docker service should be started first. Please allocate 12GB of RAM in Docker settings.

Also python need to be installed installed.

## Docker installation

```
1. Update package:
sudo apt update

2. Install package for HTTPS:

sudo apt install apt-transport-https ca-certificates curl software-properties-common
3. Add GPG-key for Docker:

curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -
4. Add repository for Docker:

sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu bionic stable"

5. Update package:

sudo apt update
6. Switc to Docker repository and install:

apt-cache policy docker-ce

7. Install Docker:

sudo apt install docker-ce

8. Check installation:

sudo systemctl status docker

Output info:
docker install ubuntu
Docker install Ubuntu

10. Add user to Docker group (not required):

sudo usermod -aG docker ${user}

11. Input (not required):

su - ${user}

Add user password (not required):

12. Check Docker image:

docker run hello-world

You must see «Hello from Docker!»

```

## Python installation 

``` 
1. Update package:
sudo apt update

2. Install python:
sudo apt install python3-pip

3. Check version:
python3 -V

Output
Python 3.8.2
```
## Other package
In additional following package also must to be installed
```
git:
sudo apt install git

docker-compose:
pip install docker-compose

jg:
sudo apt-get install jq
```


# Quick Start

```
git clone https://github.com/p2p-org/polkadot-profit-transformer.git
cd polkadot-profit-transformer

# Now fill up SUBSTRATE_URI and APP_NETWORK in docker/env/.streamer.env, docker/env/.enrichments_processor.env

# !!! Add next line to the /etc/hosts
# 127.0.0.1 broker

make up
```

`make up` command will start all services in ~5 minutes.

Then whole blocks sync begins.

Sync process continues for a few days (about 1M blocks/day)

You can check sync status by api call [http://0.0.0.0:8085/api/blocks/status](http://0.0.0.0:8085/api/blocks/status)

Port is described in [@docker-compose.yml](docker-compose.yml)

On sync in progress, you'll see `{status: "syncronization"}`

After sync completed `{status: "syncronized"}`, the streamer will switch to the finalized blocks listening, and Redash starts with pre-set datasource and dashboard.

Also you can take a look in logs by enter followinf command `docker-compose -f docker-compose.yml -f docker-compose.ksql.yml -f docker-compose.redash.yml logs -tf --tail=10 streamer`. In logs you'll see last block processing and its hash.

### Redash

During the sync and after the sync ended, you can use Redash to work with data.

Open your browser [https://localhost:5000](https://localhost:5000&), then login to Redash:

Login: admin@example.org

Password: supersecret123

_Login and password are defined in [@run.sh](run.sh)_

### Make commands

`up` Create and run all containers

`ps` Show containers

`stop` Stop all containers

`rm` Remove force all containers

#### Configuring environment

**streamer** - extracts and transform chain information from substrate node (should be launched in archive mode) via websocket connection
and push to ksql processing. Default environment configuration file _.streamer.env_.

| Command         | Default     | Description                                                  |
| --------------- | ----------- | ------------------------------------------------------------ |
| `API_ADDR`      | `0.0.0.0`   | RPC API address                                              |
| `API_PORT`      | `8080`      | RPC API port                                                 |
| `APP_MODE`      | `info`      | Logger level (`debug`, `info`, `warning`, `error`)           |
| `SUBSTRATE_URI` | -           | Substrate url to websocket connection node, `ws://host:port` |
| `KAFKA_URI`     | -           | Host to kafka broker `host:port`                             |
| `APP_MODE`      | `dev`       | Suffix for application mode (`dev`, `prod`, `staging`)       |
| `APP_NETWORK`   | -           | Must be `polkadot`, `kusama` and other                       |
| `DB_HOST`       | `localhost` | Postgresql host                                              |
| `DB_PORT`       | `5432`      | Postgresql port                                              |
| `DB_NAME`       | -           | Database name                                                |
| `DB_SCHEMA`     | `public`    | Database schema                                              |
| `DB_USER`       | `postgres`  | Database user                                                |
| `DB_PASSWORD`   | -           | User password                                                |

**enrichments_processor** - listening extracts information from kafka topics with _ENRICHMENT_ prefix and extract additional data from substrate node (should be launched in archive mode) via websocket connection
and push to ksql processing. Default environment configuration file _.enrichments_processor.env_.

| Command         | Default   | Description                                                  |
| --------------- | --------- | ------------------------------------------------------------ |
| `API_ADDR`      | `0.0.0.0` | RPC API address                                              |
| `API_PORT`      | `8079`    | RPC API port                                                 |
| `APP_MODE`      | `info`    | Logger level (`debug`, `info`, `warning`, `error`)           |
| `SUBSTRATE_URI` | -         | Substrate url to websocket connection node, `ws://host:port` |
| `KAFKA_URI`     | -         | Host to kafka broker `host:port`                             |
| `APP_MODE`      | `dev`     | Suffix for application mode (`dev`, `prod`, `staging`)       |
| `APP_NETWORK`   | -         | Must be `polkadot`, `kusama` and other                       |

Vendor environment configuration files
_.postgres.env_  
_.graphile.env_  
_.redash.env_

## Testing and overview

### Postgresql interface

1. Running psql command line from container

```shell
$ make psql
raw=# SELECT * FROM dot_polka.blocks LIMIT 10
```

2. connecting to `db` container with mapped port and credentials from `docker/env/.postges.env`

### PostGraphile UI

Local Docker instance playground
http://localhost:4000/

### GraphQL endpoint

Local Docker instance

```bash
POST http://localhost:5000/graphql
```

Example:

```bash
curl --request POST 'http://localhost:4000/graphql' \
--header 'Content-Type: application/json' \
--data '{
	"query": "query { allBlocks { edges { node { id sessionId era hash  author  } } } }",
	"variables": null
}'
```

### Health checks

You can check that the streamer is working correctly by running

```bash
docker logs polkadot-profit-transformer_streamer_1
```

The logs should look like this:

```
[1611470950389] INFO	 (1 on c0c920a5bb9a): Process block "939" with hash 0xec2c0fb4f2ccc05b0ab749197db8d6d1c6de07d6e8cb2620d5c308881d1059b5
```

### Features

This framework provides extractions blocks and subscription to updates (with reorganization support) Polkadot and Kusama.  
![schema](docs/img/mbelt_schema.png 'mbelt schema')

### Database structure

![erd](docs/img/mbelt_erd.png 'mbelt database structure')

## Modules description

- [@streamer](streamer) - The main service, provides extractions and consumer subscriptions operations for ksqlDB pipelines

- [@enrichments_processor](enrichments_processor) - The enrichments transformation service, provides extractions and consumer subscriptions operations for [ksqlDB pipelines](streamer/docs/SPECS.md)

## Sequence interaction

![Sequence](docs/img/sequence_streamer.png 'Sequence interaction')

### Additional modules:

- [@run.sh](run.sh) - Bootstrap script: creates topics from [@ksql_config.json](ksql_config.json), reads ksql migration files from [@ksql](ksql) directory and run containers
- [@docker](docker) - contains docker deploying configuration and environment files
- [@db](db) - contains database simple init migrations
- [@ksql](ksql) contains ksql init migrations

# Other docs

- [@Streamer](streamer/README.md)
- [@Watchdog](streamer/README.md#Watchdog)

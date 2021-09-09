## Requirements

- Node.js version 12 or greater
- PostgreSQL version 9 or greater

## Getting started

Streamer service provides extraction blocks and dependent events, extrinsics from Polkadot, Kusama nodes and stream data to the Kafka topics for processing.
When sent blocks count reached to finalized blocks, must run consumer for receiving finalized blocks updates.
Application provides options for actualize data and HTTP API for operations with synchronized blocks.

## Simple workflow

1. Get blocks and dependent events, extrinsics from genesis (height=0) up to finalized head block and stream to ksqlDB topics for processing
2. Run consumer for subscribe and process finalized head updates with
3. Run RESTful API for updating and status receiving operations

## Detailed workflow

[Pipeline specification](docs/SPECS.md)

### CLI usage

| Option &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | Description                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `--sync`                                                                                                                             | Synchronize blocks from node, starting with the last one saved from database, up to finalized height block number.                             |
| `--sync-force`                                                                                                                       | Synchronize blocks from node, starting with genesis, up to finalized height block number. All existing data will be updated.                   |
| `--sub-fin-head`                                                                                                                     | Subscribe to finalized headers stream. If this option used with `--sync` or `--sync-force`, consumer will start after synchronization process. |
| `--disable-rpc`                                                                                                                      | Do not run RESTful api.                                                                                                                        |

- Required ENV vars definition
- Handles ctrl+c (SIGINT) gracefully.

Recommended execution

```bash
$ npx ts-node ./src/main.ts --sync --sub-fin-head
```

Run for updating all synchronized blocks

```bash
$ npx ts-node ./src/main.ts --sync-force --disable-rpc
```

### Environment variables

####Don't forget to copy .env.example into ./src/.env when in dev mode

| Variable        | Description                                                           |   Default   |
| --------------- | --------------------------------------------------------------------- | :---------: |
| `LOG_LEVEL`     | One of `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent` |  `"info"`   |
| `API_ADDR`      | Api listening address                                                 | `"0.0.0.0"` |
| `API_PORT`      | Api listening port                                                    |   `8080`    |
| `SUBSTRATE_URI` | Polkadot node connection url                                          |    none     |
| `KAFKA_URI`     | Kafka connection url                                                  |    none     |
| `DB_HOST`       | Database host                                                         | `localhost` |
| `DB_PORT`       | Database port                                                         |   `5432`    |
| `DB_NAME`       | Database name                                                         |    none     |
| `DB_USER`       | Database user                                                         | `postgres`  |
| `DB_PASSWORD`   | Database user password                                                |    none     |

### API methods

**IMPORTANT:** HTTP API doesn't require authorization and should be run in the internal network for security reasons.

| Method &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | Description                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `GET /api/blocks/update/{blockId}`                                                                                                                                                   | Update information about block by number.                                                                        |
| `GET /api/blocks/status`                                                                                                                                                             | Get current status. Returns streamer status, synchronization status, difference between finalized head and head. |
| `POST /api/blocks/delete`                                                                                                                                                            | Remove information about blocks by numbers.                                                                      |
| `GET /api/blocks/update_trim/{blockId}`                                                                                                                                              | Trim blocks information, starting from number to finalized head.                                                 |

### Swagger endpoint

`http://{hostname}:8080/swagger/`

#

# Watchdog

Based on the same codebase, watchdog should be started by cron task periodically.

## Watchdog tasks:

- check if block exists in db
- check if block events exist in db
- check if block extrinsics exist in db
- check if parent hash of block is valid
- check if era exists in db
- check if era total stake === sum of validators total stake

In case of blocks or era error, watchdog will resync missed or corrupted data from blockchain node.

<br>

### Recommended execution:

```bash
$ npx ts-node ./src/main.ts --watchdog
```

Watchdog writes last checked block id to the `watchdog_verify_height` record in db.\_config

<br>

### Run from a specific block (block id should be less than `watchdog_verify_height` value in db.\_config )

```bash
$ npx ts-node ./src/main.ts --watchdog --watchdog-start=4975000
```

### API methods

| Method &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; | Description                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /api/watchdog/status`                                                                                                                                                           | Get current status. Show status "running/idle", and current last verified block. When in idle mode (finished to check the last block in DB), returns finished_at timestamp also. |
| `GET /api/watchdog/restart/{blockId}`                                                                                                                                                | Rewind watchdog to the specific previous block.                                                                                                                                  |

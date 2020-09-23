## Requirements
* Node.js version 12 or greater
* PostgreSQL version 9 or greater

## Getting started
Streamer service provides streaming blocks from Polkadot node and sends data to the Kafka topic. 
When sent blocks count reached to finalized blocks, must run consumer for receiving finalized blocks updates. 
Application provides options for actualize data and HTTP API for operations with synchronized blocks.

## Simple workflow

1. Get blocks from genesis (height=0) up to finalized head block and stream to ksqlDB topics for processing
2. Run consumer for process finalized head updates: for 

## Detailed workflow
[Specifications](docs/SPECS.md)

|  Option &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;| Description |
| -- | -- |
| `--sync` | Synchronize blocks from node, starting with the last one saved from database, up to finalized height block number. |
| `--sync-force` | Synchronize blocks from node, starting with genesis, up to finalized height block number. All existing data will be updated. |
| `--sub-fin-head` | Subscribe to finalized headers stream. If this option used with `--sync` or `--sync-force`, consumer will start after synchronization process. |
| `--disable-rpc`  | Do not run RESTful api. |

### CLI usage
* Required ENV vars definition
* Handles ctrl+c (SIGINT) gracefully.

Recommended execution
```bash
$ node main.js --sync --sub-fin-head
```

Run for updating all synchronized blocks
```bash
$ node main.js --sync-force --disable-rpc
```

### Environment variables 
| Variable | Description | Default |
| -- | -- | :--: |
| `LOG_LEVEL` | One of `fatal`, `error`, `warn`, `info`, `debug`, `trace` or `silent` | `"info"`|
| `API_ADDR` | Api listening address | `"0.0.0.0"`|
| `API_PORT` | Api listening port| `8080` |
| `SUBSTRATE_URI` | Polkadot node connection url | none |
| `KAFKA_URI` | Kafka connection url | none |
| `DB_HOST` | Database host | `localhost` |
| `DB_PORT` | Database port | `5432` |
| `DB_NAME` | Database name | none |
| `DB_USER` | Database user | `postgres` |
| `DB_PASSWORD` | Database user password | none | 


### API methods

**IMPORTANT:** HTTP API doesn't require authorization and should be run in the internal network for security reasons. 

| Method &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;&nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;| Description |
| -- | -- |
|`GET /update/{blockId}` | Update information about block by number. |
|`GET /status` | Get current status. Returns streamer status, synchronization status, difference between finalized head and head. |
|`POST /delete` | Remove information about blocks by numbers. |
|`GET /update_trim/{blockId}` | Trim blocks information, starting from number to finalized head. |

### Swagger endpoint

`http://{hostname}:8080/swagger/`

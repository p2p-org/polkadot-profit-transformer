### Dependensies
* Docker (memory is allocated minimally at least 8 GB)
* Docker Compose 
* jq  
* Make _(optional)_


### Installation

```shell
git clone https://github.com/p2p-org/mbelt-filecoin-streamer.git
cd mbelt-filecoin-streamer
make up
```

#### Make commands

| Command | Default |
| ---- | ---- |
| `up`| Create and run all containers |
| `ps`| Show processes |
| `stop`| Stop all containers |
| `rm`|  Remove force all containers |

### Features
This framework provides extractions blocks and subscription to updates (with reorganization support) Polkadot and Kusama.

### Overview
&nbsp; &nbsp;[@streamer](streamer) - The main service, provides extractions and consumer subscriptions operations for [ksqlDB pipelines](streamer/docs/SPECS.md)

&nbsp; &nbsp;Additional modules:
- [@run.sh](run.sh) - Bootstrap script: creates topics from [@ksql_config.json](ksql_config.json), reads ksql migration files from [@ksql](ksql) directory and run containers
- [@automation](automation) - contains tests, coverages blocks information processing with defined topics from `transformer_queries.json`
- [@db](db) - contains database simple init migrations
- [@identity_enrichment](identity_enrichment) - the python tool, for listening stream `BALANCES_WITH_IS_VALIDATOR` and engages `account_identity` table
- [@udf](udf) - User Defined Functions, required for Kafka processing

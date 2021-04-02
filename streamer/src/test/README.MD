## Preparation

* Run streamer via docker and wait until postgres to be synced with node head

## Tests 

* Check node top block with indexator top block
* Check table eras for misses by validatorsCount in validators table
* Check table eras for misses by nominatorsCount in nominators table
* Check missed hashes for sequence of blocks
* Check node top block  with indexator top block
* Check eras for low total stake
* Check eras for low total reward
* Check eras for low total reward points
* Check rewards points in eras and sum of reward points in validators by eras

## How to run tests

```shell
make run tests (from project root)
```

## Test result
```shell
docker logs polkadot-profit-transformer_streamer_tests_1
```

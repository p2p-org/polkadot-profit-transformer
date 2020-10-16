For tests suite running 

`ksql-test-runner` - tests suite executable utility.

Usage                                             
```shell script
ksql-test-runner -s statements.sql -i input.json -o output.json
```

Where  
`statements.sql` - testing threads descriptions  
`input.json` - reference input data  
`output.json` - result data for matching  


Workflow 
1. Reference input and output data contains in ./project/tests/test_data/transformer_test_data.json. 
2. Automation script reads reference data and generate: 
* sql file with requests, where target columns related from `sql_queries` field, and bodies from transformer_queries.json file in root project;
* input and output files, where fields names from input/output fields;
3. Run `ksql-test-runner` utility with generated files 


Extracted block data, contains block attributes, extrinsics and events data, sent to kafka topic `block_data`.  
The test sections descriptions:  

* `transformer_blocks_test` - positive covering `block` sinking stream: extracts data from main `block_data` stream and compare result extracted block data with selected block attributes, such as `block_number`, `hash`, `state_root` and others.  
* `transformer_events_test` - positive covering `events` sinking stream: extracts data from main `block_data` stream and compare result extracted assigned block events with a selected block events, it's attributes. 
This stream also split array data from `block_data` to separated entries.
* `transformer_extrinsics_test` - positive covering the `extrinsics` sinking stream similar to `transformer_events_test`, but for extrinsics.
* `transformer_profit_events_filter_test` - positive covering `profit_events_filter` stream. 
Checks filtering selected profit events (Deposit and Reward) from events stream. Filtering rules setting up in `profit_events_filter_rules` table.
* `transformer_balances_test` - positive covering `BALANCES` stream for checking correct relations with  account information and rewards, by joining with `block_data`.


# Database structure

- blocks: This table stores information about blocks, including network ID, block ID, hash, state root, extrinsics root, parent hash, author, digest, metadata, block time, and a unique identifier (row_id).

- events: This table stores information about events, including network ID, event ID, block ID, section, method, event data, and a unique identifier (row_id).

- extrinsics: This table stores information about extrinsics, including network ID, extrinsic ID, block ID, success, parent ID, section, method, mortal period, mortal phase, signed status, signer, tip, nonce, reference event IDs, version, extrinsic data, and a unique identifier (row_id).

- eras: This table stores information about eras, including network ID, era ID, payout block ID, session start, total reward, total stake, total reward points, and a unique identifier (row_id).

- validators: This table stores information about validators, including network ID, era ID, account ID, active status, total stake, own stake, number of nominators, reward points, reward destination, reward account ID, preferences, block time, and a unique identifier (row_id).

- nominators: This table stores information about nominators, including network ID, era ID, account ID, associated validator, clipped status, stake value, reward destination, reward account ID, block time, and a unique identifier (row_id).

- processing_tasks: This table stores information about processing tasks, including network ID, entity, entity ID, status, collection unique ID, start time, finish time, data, attempts, and a unique identifier (row_id).

- processing_state: This table stores information about the processing state, including network ID, entity, entity ID, and a unique identifier (row_id). It also has a constraint to ensure a unique combination of entity and network ID.



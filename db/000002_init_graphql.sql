CREATE SCHEMA IF NOT EXISTS graphql;

-- Blocks

CREATE TYPE substrate_block AS
(
    "id"   BIGINT,
    "hash" VARCHAR(66),
    "state_root" VARCHAR(66),
    "extrinsics_root" VARCHAR(66),
    "parent_hash" VARCHAR(66),
    "author" VARCHAR(66),
    "session_id" INT,
    "era" INT,
    "last_log" VARCHAR(100),
    "digest" JSONB,
    "block_time" TIMESTAMP
);

CREATE OR REPLACE FUNCTION graphql.all_blocks()
    RETURNS SETOF substrate_block
AS
$$
SELECT b.id,
       b.hash,
       b.state_root,
       b.extrinsics_root,
       b.parent_hash,
       b.author,
       b.session_id,
       b.era,
       b.last_log,
       b.digest,
       b.block_time
FROM dot_polka.blocks AS b
ORDER BY b.id DESC
$$
    LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION graphql.block_by_id(id BIGINT)
    RETURNS SETOF substrate_block
AS
$$
SELECT b.id,
       b.hash,
       b.state_root,
       b.extrinsics_root,
       b.parent_hash,
       b.author,
       b.session_id,
       b.era,
       b.last_log,
       b.digest,
       b.block_time
FROM dot_polka.blocks AS b
WHERE b.id = id
LIMIT 1
$$
    LANGUAGE sql STABLE;

-- Events

CREATE TYPE substrate_event AS
(
    "id" VARCHAR(150),
    "block_id" BIGINT,
    "session_id" INT,
    "era" INT,
    "section" VARCHAR(50),
    "method" VARCHAR(50),
    "data" JSONB,
    "event" JSONB
);


CREATE OR REPLACE FUNCTION graphql.all_events()
    RETURNS SETOF substrate_event
AS
$$
SELECT b.id,
       b.block_id,
       b.session_id,
       b.era,
       b.section,
       b.method,
       b.data,
       b.event
FROM dot_polka.events AS b
ORDER BY b.block_id DESC
$$
    LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION graphql.events_by_block_id(block_id BIGINT)
    RETURNS SETOF substrate_event
AS
$$
SELECT b.id,
       b.block_id,
       b.session_id,
       b.era,
       b.section,
       b.method,
       b.data,
       b.event
FROM dot_polka.events AS b
WHERE b.block_id = block_id
ORDER BY b.id ASC
$$
    LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION graphql.event_by_id(id VARCHAR(150))
    RETURNS SETOF substrate_event
AS
$$
SELECT b.id,
       b.block_id,
       b.session_id,
       b.era,
       b.section,
       b.method,
       b.data,
       b.event
FROM dot_polka.events AS b
WHERE b.id = id
LIMIT 1
$$
    LANGUAGE sql STABLE;

-- Events

CREATE TYPE substrate_extrinsic AS
(
    "id" VARCHAR(150),
    "block_id" BIGINT,
    "section" VARCHAR(50),
    "method" VARCHAR(50),
    "ref_event_ids" VARCHAR(150)[],
    "extrinsic" JSONB
);

CREATE OR REPLACE FUNCTION graphql.all_extrinsics()
    RETURNS SETOF substrate_extrinsic
AS
$$
SELECT b.id,
       b.block_id,
       b.section,
       b.method,
       b.ref_event_ids,
       b.extrinsic
FROM dot_polka.extrinsics AS b
ORDER BY b.block_id DESC
$$
    LANGUAGE sql STABLE;


CREATE OR REPLACE FUNCTION graphql.extrinsics_by_block_id(block_id BIGINT)
    RETURNS SETOF substrate_extrinsic
AS
$$
SELECT b.id,
       b.block_id,
       b.section,
       b.method,
       b.ref_event_ids,
       b.extrinsic
FROM dot_polka.extrinsics AS b
WHERE b.block_id = block_id
ORDER BY b.id ASC
$$
    LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION graphql.extrinsic_by_id(id VARCHAR(150))
    RETURNS SETOF substrate_extrinsic
AS
$$
SELECT b.id,
       b.block_id,
       b.section,
       b.method,
       b.ref_event_ids,
       b.extrinsic
FROM dot_polka.extrinsics AS b
WHERE b.id = id
LIMIT 1
$$
    LANGUAGE sql STABLE;
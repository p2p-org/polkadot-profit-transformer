CREATE TABLE block (
    "NUMBER" INTEGER NOT NULL PRIMARY KEY,
    "HASH" VARCHAR(66),
    "STATE_ROOT" VARCHAR(66),
    "EXTRINSICS_ROOT" VARCHAR(66),
    "PARENT_HASH" VARCHAR(66),
    "DIGEST" text,
    "CREATE_TIME" bigint,
    insert_time timestamp DEFAULT now() NOT NULL
);

CREATE TABLE event (
    id SERIAL NOT NULL PRIMARY KEY,
    "BLOCK_NUMBER" INTEGER NOT NULL REFERENCES block("NUMBER") ON DELETE CASCADE,
    "EVENT" text,
    insert_time timestamp DEFAULT now() NOT NULL
);

CREATE TABLE extrinsic (
    id SERIAL NOT NULL PRIMARY KEY,
    "BLOCK_NUMBER" INTEGER NOT NULL REFERENCES block("NUMBER") ON DELETE CASCADE,
    "EXTRINSIC" text,
    insert_time timestamp DEFAULT now() NOT NULL
);

CREATE TABLE account_identity (
    account_id varchar(50) NOT NULL PRIMARY KEY,
    display varchar(256),
    legal varchar(256),
    web varchar(256),
    riot varchar(256),
    email varchar(256),
    twitter varchar(256)
);


CREATE TABLE balances (
    "BLOCK_NUMBER" INTEGER NOT NULL REFERENCES block("NUMBER") ON DELETE CASCADE,
    "ACCOUNT_ID" TEXT,
    "BALANCE" BIGINT,
    "METHOD" TEXT,
    "IS_VALIDATOR" BOOLEAN,
    "CREATE_TIME" BIGINT
);


CREATE INDEX block_number_idx ON block ("NUMBER");

CREATE INDEX event_block_number_idx ON event ("BLOCK_NUMBER");

CREATE INDEX extrinsic_block_number_idx ON extrinsic ("BLOCK_NUMBER");

CREATE INDEX balances_account_id_idx ON balances ("ACCOUNT_ID");
CREATE INDEX balances_account_id_method_idx ON balances ("ACCOUNT_ID", "METHOD");

CREATE INDEX account_identity_account_id_idx ON account_identity (account_id);
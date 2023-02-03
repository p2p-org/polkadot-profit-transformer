import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.raw(`
      CREATE TABLE IF NOT EXISTS balances (
        "network_id" INT,
        "block_id" BIGINT,
        "account_id" varchar(50),
        "blake2_hash" varchar(100),
        "nonce" INT,
        "consumers" INT,
        "providers" INT,
        "sufficients" INT,
        "free" NUMERIC(35),
        "reserved" NUMERIC(35),
        "miscFrozen" NUMERIC(35),
        "feeFrozen" NUMERIC(35),
        "row_id" SERIAL,
        "row_time" TIMESTAMP,
        PRIMARY KEY ("row_id"),
        UNIQUE ("network_id", "blake2_hash", "block_id")
      )
    `);
}


export async function down(knex: Knex): Promise<void> {
}


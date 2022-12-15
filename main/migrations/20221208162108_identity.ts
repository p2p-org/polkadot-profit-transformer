import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE TABLE IF NOT EXISTS identity (
    "network_id" INT,
    "account_id" varchar(50),
    "parent_account_id" varchar(50),
    "display" varchar(256),
    "legal" varchar(256),
    "web" varchar(256),
    "riot" varchar(256),
    "email" varchar(256),
    "twitter" varchar(256),
    "judgement_status" varchar(256),
    "registrar_index" BIGINT,
    "created_at_block_id" BIGINT,
    "killed_at_block_id" BIGINT,
    "row_id" SERIAL,
    PRIMARY KEY ("row_id"),
    UNIQUE ("account_id", "network_id")
  )`);

  await knex.raw(`CREATE INDEX IF NOT EXISTS identity_parent_idx ON public.identity ("parent_account_id", "network_id")`);
}


export async function down(knex: Knex): Promise<void> {
}


import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {

    await knex.raw(`UPDATE processing_state SET entity_id=0 WHERE entity='identity_extrinsic'`);
    await knex.raw(`UPDATE processing_state SET entity_id=0 WHERE entity='identity_event'`);

    await knex.raw(`CREATE TABLE IF NOT EXISTS accounts (
        "network_id" INT,
        "account_id" varchar(50),
        "created_at_block_id" BIGINT,
        "killed_at_block_id" BIGINT,
        "judgement_status" varchar(256),
        "registrar_index" BIGINT,
        "row_id" SERIAL,
        "row_time" TIMESTAMP,
        PRIMARY KEY ("row_id"),
        UNIQUE ("account_id", "network_id")
    )`);

    await knex.raw(`ALTER TABLE IF EXISTS public.identity RENAME COLUMN created_at_block_id TO updated_at_block_id`);
    await knex.raw(`ALTER TABLE IF EXISTS public.identity DROP COLUMN killed_at_block_id`);
    await knex.raw(`ALTER TABLE IF EXISTS public.identity DROP COLUMN judgement_status`);
    await knex.raw(`ALTER TABLE IF EXISTS public.identity DROP COLUMN registrar_index`);
    await knex.raw(`ALTER TABLE IF EXISTS public.identity RENAME TO identities`);

}


export async function down(knex: Knex): Promise<void> {
}


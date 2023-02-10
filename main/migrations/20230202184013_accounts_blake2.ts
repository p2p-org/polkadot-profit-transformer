import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
    await knex.raw(`ALTER TABLE accounts ADD column if not exists blake2_hash varchar(100);`);
}


export async function down(knex: Knex): Promise<void> {
}


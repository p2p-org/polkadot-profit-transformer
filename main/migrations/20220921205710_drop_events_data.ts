import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE events DROP COLUMN data`);
}


export async function down(knex: Knex): Promise<void> {
}


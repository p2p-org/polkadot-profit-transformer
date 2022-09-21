import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE extrinsics DROP COLUMN args`);
}


export async function down(knex: Knex): Promise<void> {
}


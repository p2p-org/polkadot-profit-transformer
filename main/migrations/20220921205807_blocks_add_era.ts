import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE IF EXISTS public.blocks ADD COLUMN era integer`);
}


export async function down(knex: Knex): Promise<void> {
}


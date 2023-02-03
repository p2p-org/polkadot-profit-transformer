import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE collators ADD column if not exists final_stake numeric(35);`);
}


export async function down(knex: Knex): Promise<void> {
}


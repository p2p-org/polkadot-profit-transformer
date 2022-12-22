import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE blocks ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);
  await knex.raw(`ALTER TABLE events ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);
  await knex.raw(`ALTER TABLE extrinsics ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);
  await knex.raw(`ALTER TABLE if exists identity ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);
  await knex.raw(`ALTER TABLE if exists eras ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);
  await knex.raw(`ALTER TABLE if exists validators ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);
  await knex.raw(`ALTER TABLE if exists nominators ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);
  await knex.raw(`ALTER TABLE if exists rounds ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);
  await knex.raw(`ALTER TABLE if exists collators ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);
  await knex.raw(`ALTER TABLE if exists delegators ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);

}


export async function down(knex: Knex): Promise<void> {
}


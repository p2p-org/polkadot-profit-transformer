import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.raw(`ALTER TABLE blocks ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);
  await knex.raw(`ALTER TABLE events ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);
  await knex.raw(`ALTER TABLE extrinsics ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);
  await knex.raw(`ALTER TABLE identity ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);
  await knex.raw(`ALTER TABLE eras ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);
  await knex.raw(`ALTER TABLE validators ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);
  await knex.raw(`ALTER TABLE nominators ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);
  await knex.raw(`ALTER TABLE rounds ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);
  await knex.raw(`ALTER TABLE collators ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);
  await knex.raw(`ALTER TABLE delegators ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);
  await knex.raw(`ALTER TABLE blocks ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);
  await knex.raw(`ALTER TABLE blocks ADD COLUMN IF NOT EXISTS row_time TIMESTAMP`);
}


export async function down(knex: Knex): Promise<void> {
}


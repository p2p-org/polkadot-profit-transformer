import { Knex } from "knex";


export async function up(knex: Knex): Promise<void> {
  await knex.raw(`CREATE INDEX IF NOT EXISTS extrinsics_section_idx ON public.extrinsics ("section","method")`);
  await knex.raw(`CREATE INDEX IF NOT EXISTS events_section_idx ON public.events ("section","method")`);
}


export async function down(knex: Knex): Promise<void> {
}


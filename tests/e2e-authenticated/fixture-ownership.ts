import { createHash } from "node:crypto";
import type { Client } from "pg";
import { seedHash } from "@/game/midweek/rng";

export const FIXTURE_SEED = createHash("sha256").update("kut-e2e-midweek").digest("hex");
export const COMPLETED_SEED = createHash("sha256").update("kut-e2e-midweek-complete").digest("hex");

export type OwnedWeek = {
  id: string;
  owner_id: string;
  seed_hash: string;
  week_start: string;
  ordinal: string;
};

/** Test instrumentation is never installed on hosted Postgres, even with the test override. */
export function assertFixtureDatabase(database: Client) {
  const host = (
    database as unknown as { connectionParameters: { host: string } }
  ).connectionParameters.host.replace(/^\[|\]$/g, "");
  if (host !== "localhost" && host !== "::1" && !/^127\.\d+\.\d+\.\d+$/.test(host)) {
    throw new Error("Fixture ownership instrumentation requires a loopback database.");
  }
}

/**
 * This durable local-only journal survives runner termination. The trigger
 * records the successor UUID in the SAME transaction as _mm_open_next, so
 * there is no crash window between the worker's commit and ownership capture.
 * PostgreSQL's call stack distinguishes the opener from unrelated SQL inserts.
 * No production function or migration is changed.
 */
export async function installFixtureOwnership(database: Client) {
  assertFixtureDatabase(database);
  const fixtureHash = seedHash(FIXTURE_SEED);
  const completedHash = seedHash(COMPLETED_SEED);
  await database.query(`
    create schema if not exists kut_e2e_fixture;
    revoke all on schema kut_e2e_fixture from public, anon, authenticated;
    create table if not exists kut_e2e_fixture.weeks (
      id uuid primary key,
      owner_id uuid not null,
      seed_hash text not null,
      week_start date not null,
      children uuid[] not null default '{}',
      ordinal bigint generated always as identity
    );
    create table if not exists kut_e2e_fixture.settings (
      id boolean primary key default true check (id),
      enabled boolean not null
    );
    insert into kut_e2e_fixture.settings(id, enabled)
      select true, enabled from kut.midweek_config on conflict (id) do nothing;
    revoke all on kut_e2e_fixture.weeks from public, anon, authenticated;
    revoke all on kut_e2e_fixture.settings from public, anon, authenticated;
    create or replace function kut_e2e_fixture.capture_week()
    returns trigger language plpgsql security definer
    set search_path = pg_catalog as $$
    declare
      v_stack text;
      v_owner uuid;
      v_count integer;
    begin
      if new.seed_hash in ('${fixtureHash}', '${completedHash}') then
        v_owner := new.id;
      else
        get diagnostics v_stack = pg_context;
        if v_stack not like '%function _mm_open_next()%'
           and v_stack not like '%function kut._mm_open_next()%' then
          return new;
        end if;
        select count(*), min(j.id::text)::uuid into v_count, v_owner
        from kut_e2e_fixture.weeks j
        join kut.midweek_tournaments t on t.id = j.id
        where j.id = j.owner_id and j.seed_hash = '${fixtureHash}'
          and t.status = 'complete';
        if v_count <> 1 then
          raise exception 'Fixture opener has no unique journaled owner; preserve fixture evidence';
        end if;
      end if;
      insert into kut_e2e_fixture.weeks(id, owner_id, seed_hash, week_start)
      values (new.id, v_owner, new.seed_hash, new.week_start);
      if new.id <> v_owner then
        update kut_e2e_fixture.weeks set children = array_append(children, new.id)
        where id = v_owner;
      end if;
      return new;
    end $$;
    revoke all on function kut_e2e_fixture.capture_week() from public, anon, authenticated;
    create or replace trigger kut_e2e_capture_week
      after insert on kut.midweek_tournaments
      for each row execute function kut_e2e_fixture.capture_week();
  `);
}

export async function ownedWeeks(database: Client, ownerId?: string): Promise<OwnedWeek[]> {
  assertFixtureDatabase(database);
  // Never infer ownership for legacy residue. Missing/mismatched evidence
  // aborts cleanup before payouts, rotations, fixtures or users are removed.
  const invalid = await database.query(
    `select 1 from kut_e2e_fixture.weeks j
       left join kut.midweek_tournaments t on t.id = j.id
       where t.id is null or t.seed_hash <> j.seed_hash or t.week_start <> j.week_start
     union all
     select 1 from kut_e2e_fixture.weeks j
       where j.id = j.owner_id and not (j.seed_hash = any($1::text[]))
     union all
     select 1 from kut.midweek_tournaments t
       left join kut_e2e_fixture.weeks j on j.id = t.id
       where t.seed_hash = any($1::text[]) and j.id is null
     union all
     select 1 from kut_e2e_fixture.weeks owner
       cross join unnest(owner.children) child_id
       left join kut_e2e_fixture.weeks child on child.id = child_id and child.owner_id = owner.id
       where child.id is null
     union all
     select 1 from kut_e2e_fixture.weeks child
       left join kut_e2e_fixture.weeks owner on owner.id = child.owner_id
       where child.id <> child.owner_id
         and (owner.id is null or owner.id <> owner.owner_id or not (child.id = any(owner.children)))
     limit 1`,
    [[seedHash(FIXTURE_SEED), seedHash(COMPLETED_SEED)]],
  );
  if (invalid.rowCount) throw new Error("Fixture ownership evidence is missing or mismatched.");
  return (
    await database.query<OwnedWeek>(
      `select id, owner_id, seed_hash, week_start::text, ordinal::text
       from kut_e2e_fixture.weeks
       where ($1::uuid is null or owner_id = $1)
       order by ordinal desc`,
      [ownerId ?? null],
    )
  ).rows;
}

export async function clearOwnedWeeks(database: Client, ids: string[]) {
  assertFixtureDatabase(database);
  await database.query("delete from kut_e2e_fixture.weeks where id = any($1::uuid[])", [ids]);
}

export async function uninstallFixtureOwnership(database: Client) {
  assertFixtureDatabase(database);
  const remaining = await database.query("select 1 from kut_e2e_fixture.weeks limit 1");
  if (remaining.rowCount)
    throw new Error("Refusing to remove a nonempty fixture ownership journal.");
  await database.query(`
    drop trigger if exists kut_e2e_capture_week on kut.midweek_tournaments;
    drop function kut_e2e_fixture.capture_week();
    drop table kut_e2e_fixture.weeks;
    drop table kut_e2e_fixture.settings;
    drop schema kut_e2e_fixture;
  `);
}

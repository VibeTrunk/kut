import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { localDatabaseUrl } from "../support/local-target";

// ADR-110: the worker's open step rotates every unclaimed Player's archetype
// before it inserts the new week. Three worker calls race through the API role
// (`authenticator`, which preloads safeupdate, KB-024), as page visits make
// them: one week opens, rotated once, and every change is logged.
//
// The open step rotates every eligible Player on the stack, not only this
// suite's, so the suite records every archetype first and puts each back
// afterwards (and rebuilds the active season's card faces).
const databaseUrl = localDatabaseUrl();
const authenticatorUrl = (() => {
  const url = new URL(databaseUrl);
  url.username = "authenticator";
  return url.toString();
})();

// Every id this suite writes lives under the 51000000- prefix.
const fx = {
  unclaimed: "51000000-0000-4000-8000-000000000011",
  claimed: "51000000-0000-4000-8000-000000000012",
  member: "51000000-0000-4000-8000-000000000001",
};

let admin: Client;
const workers: Client[] = [];
let jobBaseline = 0;
let switchWas = false;
let archetypesWere: { id: string; archetype: string }[] = [];
let opened: string | null = null;

async function runWorker(client: Client) {
  await client.query("begin");
  try {
    await client.query("set local role service_role");
    await client.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ role: "service_role" }),
    ]);
    const result = await client.query("select kut.run_midweek_due(5) as run");
    await client.query("commit");
    return result.rows[0].run as { locked: number; completed: number; opened: number };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

async function cleanup() {
  if (opened) {
    // Cascades to the secret, the snapshot and the rotation log.
    await admin.query("delete from kut.midweek_tournaments where id = $1", [opened]);
  }
  await admin.query("delete from kut.profiles where id = $1", [fx.member]);
  await admin.query("delete from auth.users where id = $1", [fx.member]);
  await admin.query("delete from kut.players where id = any($1::uuid[])", [
    [fx.unclaimed, fx.claimed],
  ]);
}

describe("local Midweek open step rotates unclaimed archetypes", () => {
  beforeAll(async () => {
    admin = new Client({ connectionString: databaseUrl });
    for (let index = 0; index < 3; index += 1) {
      workers.push(new Client({ connectionString: authenticatorUrl }));
    }
    await Promise.all([admin.connect(), ...workers.map((client) => client.connect())]);
    await cleanup();

    // The open step runs only with no week open or simulated; refuse to touch
    // a stack that has one rather than remove it.
    const running = await admin.query(
      "select count(*)::int as n from kut.midweek_tournaments where status in ('open', 'simulated')",
    );
    if (running.rows[0].n > 0) {
      throw new Error(
        "A Midweek week is open on this stack; run the suite on a stack without one.",
      );
    }

    await admin.query(
      `insert into kut.players (id, slug, display_name, archetype)
       values ($1, 'mw-rotation-unclaimed', 'MW Rotation Unclaimed', 'all_rounder'),
              ($2, 'mw-rotation-claimed', 'MW Rotation Claimed', 'goalkeeper')`,
      [fx.unclaimed, fx.claimed],
    );
    await admin.query(
      `insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ($1, 'mw-rotation@example.test', 'authenticated', 'authenticated', '{}', '{}', now(), now())`,
      [fx.member],
    );
    await admin.query(
      "insert into kut.profiles (id, display_name, role, player_id) values ($1, 'MW Rotation', 'user', $2)",
      [fx.member, fx.claimed],
    );

    archetypesWere = (await admin.query("select id, archetype from kut.players")).rows;
    switchWas = (await admin.query("select enabled from kut.midweek_config")).rows[0].enabled;
    jobBaseline = (
      await admin.query("select coalesce(max(id), 0)::int as id from kut.midweek_jobs")
    ).rows[0].id;
    await admin.query("update kut.midweek_config set enabled = true");
  });

  afterAll(async () => {
    await admin.query(
      `update kut.players player set archetype = was.archetype
       from jsonb_to_recordset($1::jsonb) as was(id uuid, archetype text)
       where player.id = was.id and player.archetype <> was.archetype`,
      [JSON.stringify(archetypesWere)],
    );
    await admin.query(
      "select kut._rebuild_season_core(id) from kut.seasons where is_active limit 1",
    );
    await cleanup();
    await admin.query("delete from kut.midweek_jobs where id > $1", [jobBaseline]);
    await admin.query("update kut.midweek_config set enabled = $1", [switchWas]);
    await Promise.all([admin.end(), ...workers.map((client) => client.end())]);
  });

  it("opens one week under three concurrent calls and rotates once", async () => {
    const runs = await Promise.all(workers.map((client) => runWorker(client)));
    expect(runs.reduce((sum, run) => sum + run.opened, 0)).toBe(1);

    const errors = await admin.query(
      "select count(*)::int as n from kut.midweek_jobs where id > $1 and (error_text is not null or finished_at is null)",
      [jobBaseline],
    );
    expect(errors.rows[0].n).toBe(0);

    const week = await admin.query(
      `select tournament.id, secret.seed from kut.midweek_tournaments tournament
       join kut.midweek_tournament_secrets secret on secret.tournament_id = tournament.id
       where tournament.status = 'open'`,
    );
    expect(week.rowCount).toBe(1);
    opened = week.rows[0].id as string;
    const seed = week.rows[0].seed as string;

    // Every eligible Player has their draw from the week's seed; nobody else moved.
    const players = await admin.query(
      `select player.id, player.archetype,
         player.is_active and player.is_collectible
           and not exists (select 1 from kut.profiles profile where profile.player_id = player.id) as eligible,
         kut._mm_rotation_archetype(decode($1, 'hex'), player.id) as draw
       from kut.players player`,
      [seed],
    );
    const was = new Map(archetypesWere.map((row) => [row.id, row.archetype]));
    const moved = players.rows.filter((row) => row.archetype !== was.get(row.id));
    for (const row of players.rows) {
      expect(row.archetype).toBe(row.eligible ? row.draw : was.get(row.id));
    }
    expect(players.rows.find((row) => row.id === fx.claimed)?.archetype).toBe("goalkeeper");

    // One log row per change, from the old archetype to the new.
    const log = await admin.query(
      "select player_id, from_archetype, to_archetype from kut.midweek_archetype_rotations where tournament_id = $1",
      [opened],
    );
    expect(log.rowCount).toBe(moved.length);
    for (const row of log.rows) {
      expect(row.from_archetype).toBe(was.get(row.player_id));
      expect(row.to_archetype).toBe(
        players.rows.find((player) => player.id === row.player_id)?.archetype,
      );
    }
    const total = await admin.query(
      "select count(*)::int as n from kut.midweek_archetype_rotations where tournament_id <> $1",
      [opened],
    );
    expect(total.rows[0].n).toBe(0);

    // The week plays the rotated archetypes.
    const snapshot = await admin.query(
      `select count(*)::int as n from kut.midweek_archetype_snapshots snapshot
       join kut.players player on player.id = snapshot.player_id
       where snapshot.tournament_id = $1 and snapshot.archetype <> player.archetype`,
      [opened],
    );
    expect(snapshot.rows[0].n).toBe(0);
  });

  it("rotates nothing more on a later call", async () => {
    const before = (await admin.query("select id, archetype from kut.players order by id")).rows;
    const run = await runWorker(workers[0]);
    expect(run).toEqual({ locked: 0, completed: 0, opened: 0 });
    const after = (await admin.query("select id, archetype from kut.players order by id")).rows;
    expect(after).toEqual(before);
  });
});

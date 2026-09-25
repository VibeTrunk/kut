import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { localDatabaseUrl } from "../support/local-target";

const databaseUrl = localDatabaseUrl();

// Every id this suite writes lives under the 50000000- prefix, including its
// own players, season, sessions and tournaments. The worker enters every
// active member with a card, so members already on the stack join the field;
// their entries hang off this suite's tournaments and go with them.
const fx = {
  users: [1, 2, 3, 4].map((n) => `50000000-0000-4000-8000-00000000000${n}`),
  players: [1, 2, 3, 4].map((n) => `50000000-0000-4000-8000-00000000001${n}`),
  editions: [1, 2, 3, 4].map((n) => `50000000-0000-4000-8000-00000000002${n}`),
  cards: [1, 2, 3, 4].map((n) => `50000000-0000-4000-8000-00000000003${n}`),
  season: "50000000-0000-4000-8000-000000000041",
  sessions: ["50000000-0000-4000-8000-000000000051", "50000000-0000-4000-8000-000000000052"],
  // Locked five hours ago: due to lock and, the final long revealed, to complete.
  late: "50000000-0000-4000-8000-000000000061",
  // Locked a minute ago: due to lock only.
  fresh: "50000000-0000-4000-8000-000000000062",
  squad: "50000000-0000-4000-8000-000000000071",
};
const tournaments = [fx.late, fx.fresh];

let admin: Client;
const workers: Client[] = [];
let jobBaseline = 0;
let switchWas = false;

async function cleanup() {
  // Cascades to secrets, squads, entries, cards, pick shares, matches and events.
  await admin.query("delete from kut.midweek_tournaments where id = any($1::uuid[])", [
    tournaments,
  ]);
  await admin.query("delete from kut.match_sessions where id = any($1::uuid[])", [fx.sessions]);
  await admin.query("delete from kut.seasons where id = $1", [fx.season]);
  await admin.query("delete from kut.user_cards where id = any($1::uuid[])", [fx.cards]);
  await admin.query("delete from kut.card_editions where id = any($1::uuid[])", [fx.editions]);
  await admin.query("delete from kut.profiles where id = any($1::uuid[])", [fx.users]);
  await admin.query("delete from auth.users where id = any($1::uuid[])", [fx.users]);
  await admin.query("delete from kut.players where id = any($1::uuid[])", [fx.players]);
}

async function runWorker(client: Client) {
  await client.query("begin");
  await client.query("set local role service_role");
  await client.query("set local request.jwt.claim.role = 'service_role'");
  try {
    const result = await client.query("select kut.run_midweek_due(5) as run");
    await client.query("commit");
    return result.rows[0].run as { locked: number; completed: number; opened: number };
  } catch (error) {
    await client.query("rollback");
    throw error;
  }
}

describe("local concurrent Midweek worker race", () => {
  beforeAll(async () => {
    admin = new Client({ connectionString: databaseUrl });
    for (let index = 0; index < 3; index += 1) {
      workers.push(new Client({ connectionString: databaseUrl }));
    }
    await Promise.all([admin.connect(), ...workers.map((client) => client.connect())]);
    await cleanup();

    // The worker processes every due week it finds, so refuse to run beside one
    // that is not this suite's rather than lock or complete it.
    const foreign = await admin.query(
      `select count(*)::int as n from kut.midweek_tournaments
       where id <> all($1::uuid[])
         and ((status = 'open' and lock_at <= now()) or (status = 'simulated' and final_reveal_at <= now()))`,
      [tournaments],
    );
    if (foreign.rows[0].n > 0) {
      throw new Error(
        "A Midweek week outside this suite is due; run the suite on a stack without one.",
      );
    }
    // Switched off, the open step cannot create a week outside the prefix.
    switchWas = (await admin.query("select enabled from kut.midweek_config")).rows[0].enabled;
    await admin.query("update kut.midweek_config set enabled = false");
    jobBaseline = (
      await admin.query("select coalesce(max(id), 0)::int as id from kut.midweek_jobs")
    ).rows[0].id;

    await admin.query(
      `insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       select id, 'mw-race-' || n || '@example.test', 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now()
       from unnest($1::uuid[]) with ordinality as u(id, n)`,
      [fx.users],
    );
    await admin.query(
      `insert into kut.profiles (id, display_name, role)
       select id, 'MW Race ' || n, 'user' from unnest($1::uuid[]) with ordinality as u(id, n)`,
      [fx.users],
    );
    await admin.query(
      `insert into kut.players (id, slug, display_name, full_name, archetype)
       select id, 'mw-race-' || n, 'MW Race Player ' || n, 'MW Race Player ' || n,
         (array['goalkeeper', 'finisher', 'tank', 'all_rounder'])[n]
       from unnest($1::uuid[]) with ordinality as p(id, n)`,
      [fx.players],
    );
    await admin.query(
      `insert into kut.card_editions (id, player_id, edition_type, title, is_live)
       select e.id, p.id, 'live', 'MW Race Live', true
       from unnest($1::uuid[]) with ordinality as e(id, n) join unnest($2::uuid[]) with ordinality as p(id, n) using (n)`,
      [fx.editions, fx.players],
    );
    await admin.query(
      `insert into kut.user_cards (id, edition_id, owner_id, source)
       select c.id, e.id, u.id, 'pack'
       from unnest($1::uuid[]) with ordinality as c(id, n)
       join unnest($2::uuid[]) with ordinality as e(id, n) using (n)
       join unnest($3::uuid[]) with ordinality as u(id, n) using (n)`,
      [fx.cards, fx.editions, fx.users],
    );
    // A published session in the football week before each tournament, so the
    // club-break gate lets both run.
    await admin.query(
      "insert into kut.seasons (id, name, starts_on, is_active) values ($1, 'MW Race', date '2000-12-01', false)",
      [fx.season],
    );
    await admin.query(
      `insert into kut.match_sessions (id, season_id, session_date, session_type, status, published_at)
       values ($1, $3, date '2000-12-27', 'other', 'published', now()), ($2, $3, date '2001-01-03', 'other', 'published', now())`,
      [...fx.sessions, fx.season],
    );
    await admin.query(
      `insert into kut.midweek_tournaments (id, week_start, lock_at, seed_hash)
       values ($1, date '2001-01-01', now() + interval '1 hour', encode(sha256(decode(repeat('5a', 32), 'hex')), 'hex')),
              ($2, date '2001-01-08', now() + interval '1 hour', encode(sha256(decode(repeat('5b', 32), 'hex')), 'hex'))`,
      tournaments,
    );
    await admin.query(
      "insert into kut.midweek_tournament_secrets (tournament_id, seed) values ($1, repeat('5a', 32)), ($2, repeat('5b', 32))",
      tournaments,
    );
    // One saved squad, made while the week is still open.
    await admin.query(
      "insert into kut.midweek_squads (id, tournament_id, user_id) values ($1, $2, $3)",
      [fx.squad, fx.fresh, fx.users[0]],
    );
    await admin.query(
      "insert into kut.midweek_squad_cards (squad_id, slot, card_id, player_id) values ($1, 1, $2, $3)",
      [fx.squad, fx.cards[0], fx.players[0]],
    );
    await admin.query(
      "update kut.midweek_tournaments set lock_at = now() - interval '5 hours' where id = $1",
      [fx.late],
    );
    await admin.query(
      "update kut.midweek_tournaments set lock_at = now() - interval '1 minute' where id = $1",
      [fx.fresh],
    );
  });

  afterAll(async () => {
    await cleanup();
    await admin.query("delete from kut.midweek_jobs where id > $1", [jobBaseline]);
    await admin.query("update kut.midweek_config set enabled = $1", [switchWas]);
    await Promise.all([admin.end(), ...workers.map((client) => client.end())]);
  });

  it("locks and completes each due week exactly once under three concurrent calls", async () => {
    // Three separate connections run the worker at the same moment. Every
    // read below runs on the single `admin` client, awaited one at a time.
    const runs = await Promise.all(workers.map((client) => runWorker(client)));

    expect(runs.reduce((sum, run) => sum + run.locked, 0)).toBe(2);
    expect(runs.reduce((sum, run) => sum + run.completed, 0)).toBe(1);
    expect(runs.every((run) => run.opened === 0)).toBe(true);

    const states = await admin.query(
      "select id, status, rounds, seed from kut.midweek_tournaments where id = any($1::uuid[]) order by week_start",
      [tournaments],
    );
    expect(states.rows.map((row) => row.status)).toEqual(["complete", "simulated"]);
    expect(states.rows[0].seed).toBe("5a".repeat(32));

    for (const row of states.rows) {
      const counts = await admin.query(
        `select (select count(*)::int from kut.midweek_entries where tournament_id = $1) as entries,
                (select count(*)::int from kut.midweek_entry_cards where tournament_id = $1) as cards,
                (select count(*)::int from kut.midweek_matches where tournament_id = $1) as pairings`,
        [row.id],
      );
      const { entries, cards, pairings } = counts.rows[0];
      // One simulation: five cards per entry, and 2^R − 1 pairings (byes included).
      expect(entries).toBeGreaterThanOrEqual(4);
      expect(cards).toBe(entries * 5);
      expect(pairings).toBe(2 ** row.rounds - 1);
    }

    const errors = await admin.query(
      "select count(*)::int as n from kut.midweek_jobs where id > $1 and (error_text is not null or finished_at is null)",
      [jobBaseline],
    );
    expect(errors.rows[0].n).toBe(0);
  });

  it("does nothing more on a later call", async () => {
    const run = await runWorker(workers[0]);
    expect(run).toEqual({ locked: 0, completed: 0, opened: 0 });
  });
});

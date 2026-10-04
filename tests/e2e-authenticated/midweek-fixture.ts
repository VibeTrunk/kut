import type { Client } from "pg";
import { lockAt, nextTournamentWeek } from "@/game/midweek/schedule";
import { seedHash } from "@/game/midweek/rng";
import {
  assertFixtureDatabase,
  clearOwnedWeeks,
  COMPLETED_SEED,
  FIXTURE_SEED,
  installFixtureOwnership,
  ownedWeeks,
  uninstallFixtureOwnership,
  type OwnedWeek,
} from "./fixture-ownership";

/**
 * Midweek Madness for the authenticated E2E: release_member owns six cards of
 * five fixture Players (one a Goalkeeper, one owned twice), and the switch is
 * on with next week's tournament open, its lock ahead (PR 7).
 *
 * PR 8 adds a completed week, `COMPLETED_WEEK`, played by release_member and
 * four fixture members (and any member already on the stack who owns a card,
 * since the worker enters everyone). Five entrants make 8 slots, so round 1
 * mixes byes with matches, which the bracket tree check needs (KB-031). It is
 * seeded as
 * `tests/integration/midweek-race.test.ts` seeds one: a published session in
 * the football week before it for the club-break gate, the tournament
 * inserted open with its lock ahead, release_member's five saved, the lock
 * moved into the past (allowed while open), then `kut.run_midweek_due` run as
 * the service role until the week is complete and paid. Its lock is in 2001,
 * so it is long past owner decision D4's cutoff and the picker tests still see
 * the picker.
 *
 * Everything carries the `00000097-` id prefix, and each tournament a fixed
 * seed, so a run left behind by a crash is found and removed next time. The
 * seeds are a fixture's, never a real week's.
 */

const PREFIX = "00000097-0000-4000-8000-";
const PLAYERS = [
  ["01", "Keeper Fixture", "goalkeeper"],
  ["02", "Winger Fixture", "speedster"],
  ["03", "Striker Fixture", "finisher"],
  ["04", "Wall Fixture", "defender"],
  ["05", "Engine Fixture", "playmaker"],
] as const;

/** The completed week's Monday, and its lock (a Wednesday 20:00 CET). */
export const COMPLETED_WEEK = "2001-01-15";
const COMPLETED_LOCK = "2001-01-17T19:00:00.000Z";

type Kind = "1" | "2" | "3" | "4" | "5" | "6";
/** 1 Players, 2 editions, 3 release_member's cards, 4 fixture members, 5 their cards, 6 season and session. */
const id = (kind: Kind, n: string) => `${PREFIX}0000000${kind}00${n}`;

/** Four more members for the completed week, each owning one fixture Player. */
const MEMBERS = [
  ["01", "Fixture Manager A", "01"],
  ["02", "Fixture Manager B", "02"],
  ["03", "Fixture Manager C", "03"],
  ["04", "Fixture Manager D", "04"],
] as const;

/**
 * Takes back exactly what these weeks paid, members already on the stack
 * included, and removes their rewards, ledger rows and result messages (a paid
 * reward restricts deleting its week, match or member).
 */
async function takeBackPayouts(database: Client, weeks: string[]) {
  await database.query(
    `update kut.wallets wallet set balance = wallet.balance - paid.total, updated_at = now()
     from (select user_id, sum(amount) as total from kut.midweek_rewards
           where tournament_id = any($1::uuid[]) group by user_id) paid
     where wallet.user_id = paid.user_id`,
    [weeks],
  );
  await database.query(
    "delete from kut.user_notifications where event_type = 'midweek_result' and reference_id = any($1::uuid[])",
    [weeks],
  );
  const paid = await database.query<{ ledger_id: string }>(
    "delete from kut.midweek_rewards where tournament_id = any($1::uuid[]) returning ledger_id",
    [weeks],
  );
  await database.query("delete from kut.wallet_ledger where id = any($1::uuid[])", [
    paid.rows.map((row) => row.ledger_id),
  ]);
  // Calls that came true (ADR-118): one guarded row per (week, member).
  await database.query(
    `update kut.wallets wallet set balance = wallet.balance - paid.total, updated_at = now()
     from (select user_id, sum(amount) as total from kut.midweek_prediction_rewards
           where tournament_id = any($1::uuid[]) group by user_id) paid
     where wallet.user_id = paid.user_id`,
    [weeks],
  );
  const called = await database.query<{ ledger_id: string }>(
    "delete from kut.midweek_prediction_rewards where tournament_id = any($1::uuid[]) returning ledger_id",
    [weeks],
  );
  await database.query("delete from kut.wallet_ledger where id = any($1::uuid[])", [
    called.rows.map((row) => row.ledger_id),
  ]);
}

async function fixtureTransaction<T>(database: Client, work: () => Promise<T>): Promise<T> {
  assertFixtureDatabase(database);
  await database.query("begin");
  try {
    await database.query("select pg_advisory_xact_lock(hashtext('kut._mm_open_next'))");
    const result = await work();
    await database.query("commit");
    return result;
  } catch (error) {
    await database.query("rollback");
    throw error;
  }
}

async function removeOwnedTournaments(database: Client, records: OwnedWeek[]) {
  let rebuilt = false;
  // Reverse in creation order so successive rotations of the same Player
  // unwind correctly. Refuse an intervening unowned archetype edit.
  for (const record of records.filter((row) => row.id !== row.owner_id)) {
    const conflict = await database.query(
      `select 1 from kut.midweek_archetype_rotations r
       join kut.players p on p.id = r.player_id
       where r.tournament_id = $1 and p.archetype <> r.to_archetype limit 1`,
      [record.id],
    );
    if (conflict.rowCount) throw new Error("An owned rotation has an intervening archetype edit.");
    const rotated = await database.query(
      `update kut.players p set archetype = r.from_archetype
       from kut.midweek_archetype_rotations r
       where r.player_id = p.id and r.tournament_id = $1`,
      [record.id],
    );
    rebuilt ||= Boolean(rotated.rowCount);
  }
  if (rebuilt)
    await database.query(
      "select kut._rebuild_season_core(id) from kut.seasons where is_active limit 1",
    );
  const weeks = records.map((row) => row.id);
  // The completed week paid its winners: take that back first.
  await takeBackPayouts(database, weeks);
  // Cascades to secrets, squads, entries, cards, pick shares, matches and events.
  await database.query("delete from kut.midweek_tournaments where id = any($1::uuid[])", [weeks]);
  await clearOwnedWeeks(database, weeks);
}

export async function removeMidweekFixture(database: Client, uninstall = false) {
  await fixtureTransaction(database, async () => {
    await installFixtureOwnership(database);
    await removeOwnedTournaments(database, await ownedWeeks(database));
    await database.query("delete from kut.match_sessions where id::text like $1", [`${PREFIX}%`]);
    await database.query("delete from kut.seasons where id::text like $1", [`${PREFIX}%`]);
    await database.query("delete from kut.user_cards where id::text like $1", [`${PREFIX}%`]);
    await database.query("delete from kut.card_editions where id::text like $1", [`${PREFIX}%`]);
    await database.query("delete from kut.players where id::text like $1", [`${PREFIX}%`]);
    await database.query("delete from kut.wallets where user_id::text like $1", [`${PREFIX}%`]);
    await database.query("delete from kut.profiles where id::text like $1", [`${PREFIX}%`]);
    await database.query("delete from auth.users where id::text like $1", [`${PREFIX}%`]);
    await database.query(
      "update kut.midweek_config set enabled = (select enabled from kut_e2e_fixture.settings where id)",
    );
    if (uninstall) await uninstallFixtureOwnership(database);
  });
}

export async function seedMidweekFixture(database: Client, memberId: string) {
  await removeMidweekFixture(database);

  const weekStart = nextTournamentWeek(new Date());
  const clash = await database.query(
    "select 1 from kut.midweek_tournaments where week_start = $1 or status in ('open', 'simulated')",
    [weekStart],
  );
  if (clash.rowCount) {
    throw new Error(
      `A Midweek week outside this suite is open or already exists for ${weekStart}; run the E2E on a stack without one.`,
    );
  }
  await database.query("update kut.midweek_config set enabled = false");

  for (const [n, name, archetype] of PLAYERS) {
    await database.query(
      "insert into kut.players(id, slug, display_name, archetype) values ($1, $2, $3, $4)",
      [id("1", n), `e2e-midweek-${n}`, name, archetype],
    );
    await database.query(
      "insert into kut.card_editions(id, player_id, edition_type, title, is_live) values ($1, $2, 'live', $3, true)",
      [id("2", n), id("1", n), `${name} Live`],
    );
    await database.query(
      "insert into kut.user_cards(id, edition_id, owner_id, source) values ($1, $2, $3, 'pack')",
      [id("3", n), id("2", n), memberId],
    );
  }
  // A second copy of the first Player: one tile, "×2 copies".
  await database.query(
    "insert into kut.user_cards(id, edition_id, owner_id, source) values ($1, $2, $3, 'pack')",
    [id("3", "06"), id("2", "01"), memberId],
  );

  // The completed week first, while the switch is still off, so the worker's
  // open step cannot create a real week beside it.
  await seedCompletedWeek(database, memberId);

  await database.query("update kut.midweek_config set enabled = true");
  await openFixtureWeek(database, weekStart);
}

/** Next week's tournament, open with its lock ahead: what the picker tests use. */
async function openFixtureWeek(database: Client, weekStart: string) {
  const tournament = await database.query<{ id: string }>(
    "insert into kut.midweek_tournaments(week_start, lock_at, seed_hash) values ($1, $2, $3) returning id",
    [weekStart, lockAt(weekStart).toISOString(), seedHash(FIXTURE_SEED)],
  );
  await database.query(
    "insert into kut.midweek_tournament_secrets(tournament_id, seed) values ($1, $2)",
    [tournament.rows[0].id, FIXTURE_SEED],
  );
}

/** One worker call as the service role, as the lazy trigger makes it (ADR-098). */
async function runWorker(database: Client) {
  await database.query("begin");
  try {
    await database.query("set local role service_role");
    await database.query("set local request.jwt.claim.role = 'service_role'");
    await database.query("select kut.run_midweek_due(5)");
    await database.query("commit");
  } catch (error) {
    await database.query("rollback");
    throw error;
  }
}

async function seedCompletedWeek(database: Client, memberId: string) {
  for (const [n, name, player] of MEMBERS) {
    await database.query(
      `insert into auth.users (id, email, aud, role, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
       values ($1, $2, 'authenticated', 'authenticated', '{}'::jsonb, '{}'::jsonb, now(), now())`,
      [id("4", n), `e2e-midweek-${n}@users.kut.local`],
    );
    await database.query(
      "insert into kut.profiles (id, display_name, role) values ($1, $2, 'user')",
      [id("4", n), name],
    );
    await database.query(
      "insert into kut.user_cards(id, edition_id, owner_id, source) values ($1, $2, $3, 'pack')",
      [id("5", n), id("2", player), id("4", n)],
    );
  }
  // A published session in the football week before, so the club-break gate
  // lets the week run.
  await database.query(
    "insert into kut.seasons (id, name, starts_on, is_active) values ($1, 'E2E Midweek', date '2000-12-01', false)",
    [id("6", "01")],
  );
  await database.query(
    `insert into kut.match_sessions (id, season_id, session_date, session_type, status, published_at)
     values ($1, $2, date '2001-01-10', 'other', 'published', now())`,
    [id("6", "02"), id("6", "01")],
  );

  const tournament = await database.query<{ id: string }>(
    // Schedule version 1 (ADR-104): a 20:00 lock, rounds revealed whole every 30 minutes.
    "insert into kut.midweek_tournaments(week_start, lock_at, seed_hash, schedule_version) values ($1, now() + interval '1 hour', $2, 1) returning id",
    [COMPLETED_WEEK, seedHash(COMPLETED_SEED)],
  );
  const tournamentId = tournament.rows[0].id;
  await database.query(
    "insert into kut.midweek_tournament_secrets(tournament_id, seed) values ($1, $2)",
    [tournamentId, COMPLETED_SEED],
  );
  // release_member's five, saved while the week is open.
  const squad = await database.query<{ id: string }>(
    "insert into kut.midweek_squads (tournament_id, user_id) values ($1, $2) returning id",
    [tournamentId, memberId],
  );
  for (const [slot, [n]] of PLAYERS.entries()) {
    await database.query(
      "insert into kut.midweek_squad_cards (squad_id, slot, card_id, player_id) values ($1, $2, $3, $4)",
      [squad.rows[0].id, slot + 1, id("3", n), id("1", n)],
    );
  }
  await database.query("update kut.midweek_tournaments set lock_at = $2 where id = $1", [
    tournamentId,
    COMPLETED_LOCK,
  ]);

  // Lock (simulate), then complete (pay and publish the seed).
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await runWorker(database);
    const status = await database.query<{ status: string }>(
      "select status from kut.midweek_tournaments where id = $1",
      [tournamentId],
    );
    if (status.rows[0].status === "complete") return;
  }
  throw new Error("The completed Midweek fixture week did not complete.");
}

/**
 * Both device projects run the same tests against one fixture, so each
 * Midweek test starts from "not picked, taking part".
 */
export async function resetMidweekMember(database: Client, username: string) {
  await database.query(
    `delete from kut.midweek_squads squad
     using kut.profiles profile, kut.midweek_tournaments tournament
     where squad.user_id = profile.id and profile.username = $1
       and tournament.id = squad.tournament_id and tournament.seed_hash = $2`,
    [username, seedHash(FIXTURE_SEED)],
  );
  await database.query(
    `delete from kut.midweek_opt_outs using kut.profiles profile
     where midweek_opt_outs.user_id = profile.id and profile.username = $1`,
    [username],
  );
  // Every fixture Player plays the open week as their live archetype again.
  await database.query(
    `update kut.midweek_archetype_snapshots snapshot set archetype = player.archetype
     from kut.players player, kut.midweek_tournaments tournament
     where player.id = snapshot.player_id and tournament.id = snapshot.tournament_id
       and tournament.seed_hash = $1`,
    [seedHash(FIXTURE_SEED)],
  );
}

/**
 * KB-028: the open week plays `displayName` as `archetype`, as if the Player's
 * archetype changed after the week opened. `resetMidweekMember` undoes it.
 */
export async function setWeekArchetype(database: Client, displayName: string, archetype: string) {
  const result = await database.query(
    `update kut.midweek_archetype_snapshots snapshot set archetype = $3
     from kut.players player, kut.midweek_tournaments tournament
     where player.id = snapshot.player_id and tournament.id = snapshot.tournament_id
       and tournament.seed_hash = $1 and player.display_name = $2`,
    [seedHash(FIXTURE_SEED), displayName, archetype],
  );
  if (result.rowCount !== 1) throw new Error(`No open-week snapshot for ${displayName}.`);
}

// ---- tonight's evening (F5, ADR-113) ---------------------------------------------

async function fixtureWeek(database: Client) {
  const week = await database.query<{ id: string; week_start: string; status: string }>(
    "select id, week_start::text, status from kut.midweek_tournaments where seed_hash = $1",
    [seedHash(FIXTURE_SEED)],
  );
  if (week.rowCount !== 1) throw new Error("The open Midweek fixture week is missing.");
  return week.rows[0];
}

/**
 * Turns the open fixture week into tonight's evening, its lock a minute ago:
 * a published session in the football week before it (the club-break gate),
 * the lock moved back (allowed while the week is open), and the worker run to
 * draw it. Everyone who owns a card is entered, release_member with an auto
 * squad unless they saved one. `endFixtureEvening` puts the open week back.
 */
export async function startFixtureEvening(
  database: Client,
): Promise<{ weekStart: string; rounds: number }> {
  const week = await fixtureWeek(database);
  await database.query(
    `insert into kut.match_sessions (id, season_id, session_date, session_type, status, published_at)
     values ($1, $2, $3::date - 5, 'other', 'published', now())`,
    [id("6", "03"), id("6", "01"), week.week_start],
  );
  await database.query(
    "update kut.midweek_tournaments set lock_at = now() - interval '1 minute' where id = $1",
    [week.id],
  );
  await runWorker(database);
  const drawn = await database.query<{ status: string; rounds: number | null }>(
    "select status, rounds from kut.midweek_tournaments where id = $1",
    [week.id],
  );
  if (drawn.rows[0].status !== "simulated" || !drawn.rows[0].rounds) {
    throw new Error(`The fixture evening did not draw: ${drawn.rows[0].status}.`);
  }
  return { weekStart: week.week_start, rounds: drawn.rows[0].rounds };
}

/**
 * Moves tonight's evening `minutes` into the past, so the pages read it as
 * that much later: the lock, the end of the final, and every stored match and
 * event time. A stored result never changes (Part L #25), so this bypasses the
 * guards with `session_replication_role = replica` for one transaction, which
 * only the local stack allows. With `runWorker`, the worker runs after, as a
 * page visit would (it pays and completes a week whose final has ended).
 */
export async function advanceFixtureEvening(
  database: Client,
  minutes: number,
  options: { runWorker?: boolean } = {},
) {
  const week = await fixtureWeek(database);
  const shift = `${minutes} minutes`;
  await database.query("begin");
  try {
    await database.query("set local session_replication_role = replica");
    await database.query(
      `update kut.midweek_tournaments
       set lock_at = lock_at - $2::interval, final_reveal_at = final_reveal_at - $2::interval
       where id = $1`,
      [week.id, shift],
    );
    await database.query(
      `update kut.midweek_matches
       set reveal_at = reveal_at - $2::interval, ends_at = ends_at - $2::interval
       where tournament_id = $1`,
      [week.id, shift],
    );
    await database.query(
      `update kut.midweek_match_events event set reveal_at = event.reveal_at - $2::interval
       from kut.midweek_matches played
       where played.id = event.match_id and played.tournament_id = $1`,
      [week.id, shift],
    );
    await database.query("commit");
  } catch (error) {
    await database.query("rollback");
    throw error;
  }
  if (options.runWorker) await runWorker(database);
}

/**
 * Ends tonight's evening and leaves the open week as `seedMidweekFixture` did:
 * takes back anything it paid, deletes it with every row it stored, undoes the
 * rotation of the week the worker opened after it and deletes that week, if
 * any, and opens the fixture week again.
 */
export async function endFixtureEvening(database: Client) {
  await fixtureTransaction(database, async () => {
    const week = await fixtureWeek(database);
    const records = await ownedWeeks(database, week.id);
    await database.query("delete from kut.match_sessions where id = $1", [id("6", "03")]);
    if (week.status === "open") {
      // A start that failed before the draw: only the lock moved.
      await database.query("update kut.midweek_tournaments set lock_at = $2 where id = $1", [
        week.id,
        lockAt(week.week_start).toISOString(),
      ]);
      return;
    }
    // Opening the week after it rotated every unclaimed Player, the fixture's
    // included (ADR-110). Put each archetype back from that week's log before the
    // delete takes the log with it, and the card faces with them.
    await removeOwnedTournaments(database, records);
    await openFixtureWeek(database, week.week_start);
  });
}

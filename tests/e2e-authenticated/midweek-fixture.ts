import { createHash } from "node:crypto";
import type { Client } from "pg";
import { lockAt, nextTournamentWeek } from "@/game/midweek/schedule";
import { seedHash } from "@/game/midweek/rng";

/**
 * Midweek Madness for the authenticated E2E: release_member owns six cards of
 * five fixture Players (one a Goalkeeper, one owned twice), and the switch is
 * on with next week's tournament open, its lock ahead (PR 7).
 *
 * PR 8 adds a completed week, `COMPLETED_WEEK`, played by release_member and
 * three fixture members (and any member already on the stack who owns a card,
 * since the worker enters everyone). It is seeded as
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
const FIXTURE_SEED = createHash("sha256").update("kut-e2e-midweek").digest("hex");
const COMPLETED_SEED = createHash("sha256").update("kut-e2e-midweek-complete").digest("hex");

/** The completed week's Monday, and its lock (a Wednesday 20:00 CET). */
export const COMPLETED_WEEK = "2001-01-15";
const COMPLETED_LOCK = "2001-01-17T19:00:00.000Z";

type Kind = "1" | "2" | "3" | "4" | "5" | "6";
/** 1 Players, 2 editions, 3 release_member's cards, 4 fixture members, 5 their cards, 6 season and session. */
const id = (kind: Kind, n: string) => `${PREFIX}0000000${kind}00${n}`;

/** Three more members for the completed week, each owning one fixture Player. */
const MEMBERS = [
  ["01", "Fixture Manager A", "01"],
  ["02", "Fixture Manager B", "02"],
  ["03", "Fixture Manager C", "03"],
] as const;

export async function removeMidweekFixture(database: Client) {
  const fixtureWeeks = [seedHash(FIXTURE_SEED), seedHash(COMPLETED_SEED)];
  const weeks = (
    await database.query<{ id: string }>(
      "select id from kut.midweek_tournaments where seed_hash = any($1::text[])",
      [fixtureWeeks],
    )
  ).rows.map((row) => row.id);
  // The completed week paid its winners, members already on the stack
  // included: take back exactly what it paid before its rewards and ledger
  // rows go (a paid reward restricts deleting its week, match or member).
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
  // Cascades to secrets, squads, entries, cards, pick shares, matches and events.
  await database.query("delete from kut.midweek_tournaments where id = any($1::uuid[])", [weeks]);
  await database.query("delete from kut.match_sessions where id::text like $1", [`${PREFIX}%`]);
  await database.query("delete from kut.seasons where id::text like $1", [`${PREFIX}%`]);
  await database.query("delete from kut.user_cards where id::text like $1", [`${PREFIX}%`]);
  await database.query("delete from kut.card_editions where id::text like $1", [`${PREFIX}%`]);
  await database.query("delete from kut.players where id::text like $1", [`${PREFIX}%`]);
  await database.query("delete from kut.wallets where user_id::text like $1", [`${PREFIX}%`]);
  await database.query("delete from kut.profiles where id::text like $1", [`${PREFIX}%`]);
  await database.query("delete from auth.users where id::text like $1", [`${PREFIX}%`]);
  // The migration's default. Local stacks keep it off between runs, so the
  // teardown puts it back rather than remembering what it was.
  await database.query("update kut.midweek_config set enabled = false");
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
  const tournament = await database.query<{ id: string }>(
    "insert into kut.midweek_tournaments(week_start, lock_at, seed_hash) values ($1, $2, $3) returning id",
    [weekStart, lockAt(weekStart).toISOString(), seedHash(FIXTURE_SEED)],
  );
  await database.query(
    "insert into kut.midweek_tournament_secrets(tournament_id, seed) values ($1, $2)",
    [tournament.rows[0].id, FIXTURE_SEED],
  );
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
    "insert into kut.midweek_tournaments(week_start, lock_at, seed_hash) values ($1, now() + interval '1 hour', $2) returning id",
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
}

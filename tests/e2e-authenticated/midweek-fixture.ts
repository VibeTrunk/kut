import { createHash } from "node:crypto";
import type { Client } from "pg";
import { lockAt, nextTournamentWeek } from "@/game/midweek/schedule";
import { seedHash } from "@/game/midweek/rng";

/**
 * Midweek Madness for the authenticated E2E (PR 7): release_member owns six
 * cards of five fixture Players (one a Goalkeeper, one owned twice), and the
 * switch is on with next week's tournament open, its lock ahead.
 *
 * Everything carries the `00000097-` id prefix, and the tournament a fixed
 * seed, so a run left behind by a crash is found and removed next time. The
 * seed is a fixture's, never a real week's; the page only ever shows its hash.
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

const id = (kind: "1" | "2" | "3", n: string) => `${PREFIX}0000000${kind}00${n}`;

export async function removeMidweekFixture(database: Client) {
  await database.query("delete from kut.midweek_tournaments where seed_hash = $1", [
    seedHash(FIXTURE_SEED),
  ]);
  await database.query("delete from kut.user_cards where id::text like $1", [`${PREFIX}%`]);
  await database.query("delete from kut.card_editions where id::text like $1", [`${PREFIX}%`]);
  await database.query("delete from kut.players where id::text like $1", [`${PREFIX}%`]);
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

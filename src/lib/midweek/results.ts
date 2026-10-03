import { resolvePhotoUrls } from "@/lib/player-photos";
import type { MyPredictionRewardRow, MyPredictionRow, PredictionSplitRow } from "./calls";
import type { createClient } from "@/lib/supabase/server";
import type { MidweekTournament, MyRewardRow } from "./entry";
import { maskInPlay } from "./live";
import { loadMatchEnds } from "./live-load";
import { nightRatings, playedMatches, type NightRatings } from "./night-ratings";
import type { DrawRow, EntryCardRow, EventRow, MatchRow, PickShareRow } from "./rows";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Reads for the Midweek results pages (PR 8). Unlike the entry points, these
 * throw on a failed read: once a page is showing a week's results, "nothing
 * here" would be a false statement about the bracket (ADR-097's rule for the
 * picker). A denied read still returns zero rows (ADR-079), which the views'
 * own time gates also produce before a round is out.
 */

export async function loadTournamentByWeek(
  supabase: SupabaseServerClient,
  weekStart: string,
): Promise<MidweekTournament | null> {
  const { data, error } = await supabase
    .schema("kut")
    .from("midweek_tournaments_public")
    .select("*")
    .eq("week_start", weekStart)
    .maybeSingle();
  if (error) throw new Error("Could not load this Midweek Madness week.");
  return (data ?? null) as MidweekTournament | null;
}

/**
 * One week as members may see it now: round 1's draw and every entered card
 * from the lock (ADR-105), and the pairings kicked off so far, byes included,
 * each without its result while it is in play (`maskInPlay`, ADR-115).
 */
export async function loadWeekResults(
  supabase: SupabaseServerClient,
  tournamentId: string,
  now: Date = new Date(),
): Promise<{ draw: DrawRow[]; matches: MatchRow[]; entries: EntryCardRow[] }> {
  const [draw, matches, entries, ends] = await Promise.all([
    supabase
      .schema("kut")
      .from("midweek_draw_public")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("pairing"),
    supabase
      .schema("kut")
      .from("midweek_matches_public")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("round")
      .order("pairing"),
    supabase
      .schema("kut")
      .from("midweek_entries_public")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("user_id")
      .order("slot"),
    loadMatchEnds(tournamentId),
  ]);
  if (draw.error || matches.error || entries.error) {
    throw new Error("Could not load this week's results.");
  }
  return {
    draw: (draw.data ?? []) as DrawRow[],
    matches: maskInPlay((matches.data ?? []) as MatchRow[], ends, now),
    entries: (entries.data ?? []) as EntryCardRow[],
  };
}

/**
 * Night ratings once the week is complete (DR3 HANDOFF §1): the events of
 * every listed member's matches in one query, never one call per match, and
 * the photos of their fives. The ratings block wants the member's; the share
 * images the champion's too. A member who wasn't entered has no entry, and
 * nothing is rated before the week is complete (ADR-117).
 */
export async function loadNightRatingsFor(
  supabase: SupabaseServerClient,
  tournament: Pick<MidweekTournament, "status" | "rounds" | "seed_hash" | "week_start">,
  results: { matches: readonly MatchRow[]; entries: readonly EntryCardRow[] },
  userIds: readonly string[],
): Promise<Map<string, NightRatings>> {
  const rated = new Map<string, NightRatings>();
  if (tournament.status !== "complete" || !tournament.rounds) return rated;
  const members = [...new Set(userIds)].filter(
    (id) =>
      results.entries.some((row) => row.user_id === id) &&
      playedMatches(results.matches, id).length > 0,
  );
  if (members.length === 0) return rated;
  const matchIds = [
    ...new Set(
      members.flatMap((id) =>
        playedMatches(results.matches, id).map(({ match }) => match.match_id),
      ),
    ),
  ];
  const [events, photoUrls] = await Promise.all([
    supabase
      .schema("kut")
      .from("midweek_events_public")
      .select("*")
      .in("match_id", matchIds)
      .order("seq"),
    resolvePhotoUrls(
      supabase,
      results.entries.filter((row) => members.includes(row.user_id)).map((row) => row.photo_path),
    ),
  ]);
  if (events.error) throw new Error("Could not load the night's ratings.");
  for (const userId of members) {
    const night = nightRatings({
      seedHash: tournament.seed_hash ?? "",
      userId,
      rounds: tournament.rounds,
      weekStart: tournament.week_start,
      matches: results.matches,
      events: (events.data ?? []) as EventRow[],
      entries: results.entries,
      photoUrls,
    });
    if (night) rated.set(userId, night);
  }
  return rated;
}

/** One member's night ratings (`loadNightRatingsFor`), or null. */
export async function loadNightRatings(
  supabase: SupabaseServerClient,
  tournament: Pick<MidweekTournament, "status" | "rounds" | "seed_hash" | "week_start">,
  results: { matches: readonly MatchRow[]; entries: readonly EntryCardRow[] },
  userId: string,
): Promise<NightRatings | null> {
  return (await loadNightRatingsFor(supabase, tournament, results, [userId])).get(userId) ?? null;
}

/**
 * Calls for one week (ADR-118): the caller's own picks, the club's splits from
 * each kick-off, and the caller's prediction coins once paid. Tolerant: a
 * failed read (or a database without the views) reads as no calls, so the
 * evening never fails over them.
 */
export async function loadCalls(
  supabase: SupabaseServerClient,
  tournamentId: string,
): Promise<{
  predictions: MyPredictionRow[];
  splits: PredictionSplitRow[];
  reward: MyPredictionRewardRow | null;
}> {
  const [predictions, splits, rewards] = await Promise.all([
    supabase
      .schema("kut")
      .from("my_midweek_predictions")
      .select("*")
      .eq("tournament_id", tournamentId),
    supabase
      .schema("kut")
      .from("midweek_prediction_splits_public")
      .select("*")
      .eq("tournament_id", tournamentId),
    supabase
      .schema("kut")
      .from("my_midweek_prediction_rewards")
      .select("*")
      .eq("tournament_id", tournamentId),
  ]);
  return {
    predictions: predictions.error ? [] : ((predictions.data ?? []) as MyPredictionRow[]),
    splits: splits.error ? [] : ((splits.data ?? []) as PredictionSplitRow[]),
    reward: rewards.error ? null : (((rewards.data ?? [])[0] as MyPredictionRewardRow) ?? null),
  };
}

export async function loadMyRewards(
  supabase: SupabaseServerClient,
  tournamentId: string,
): Promise<MyRewardRow[]> {
  const { data, error } = await supabase
    .schema("kut")
    .from("my_midweek_rewards")
    .select("*")
    .eq("tournament_id", tournamentId);
  if (error) throw new Error("Could not load your Midweek coins.");
  return (data ?? []) as MyRewardRow[];
}

export async function loadPickShares(
  supabase: SupabaseServerClient,
  tournamentId: string,
): Promise<PickShareRow[]> {
  const { data, error } = await supabase
    .schema("kut")
    .from("midweek_pick_shares_public")
    .select("*")
    .eq("tournament_id", tournamentId);
  if (error) throw new Error("Could not load this week's pick shares.");
  return (data ?? []) as PickShareRow[];
}

/**
 * `/midweek/past`: every week's public row, the entrants of each (one row per
 * entrant: their first card), and the caller's own rewards.
 */
export async function loadPastWeeks(supabase: SupabaseServerClient): Promise<{
  tournaments: MidweekTournament[];
  entrants: { tournament_id: string; user_id: string }[];
  rewards: MyRewardRow[];
}> {
  const [tournaments, entrants, rewards] = await Promise.all([
    supabase
      .schema("kut")
      .from("midweek_tournaments_public")
      .select("*")
      .order("week_start", { ascending: false }),
    supabase
      .schema("kut")
      .from("midweek_entries_public")
      .select("tournament_id, user_id")
      .eq("slot", 0),
    supabase.schema("kut").from("my_midweek_rewards").select("*"),
  ]);
  if (tournaments.error || entrants.error || rewards.error) {
    throw new Error("Could not load the past weeks.");
  }
  return {
    tournaments: (tournaments.data ?? []) as MidweekTournament[],
    entrants: (entrants.data ?? []) as { tournament_id: string; user_id: string }[],
    rewards: (rewards.data ?? []) as MyRewardRow[],
  };
}

import { resolvePhotoUrls } from "@/lib/player-photos";
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
 * A member's night ratings once the week is complete (DR3 HANDOFF §1): the
 * events of their own matches in one query, never one call per match, and the
 * photos of their five. Null when they weren't entered, or before the week is
 * complete, when a rating can't be known yet (ADR-117).
 */
export async function loadNightRatings(
  supabase: SupabaseServerClient,
  tournament: Pick<MidweekTournament, "status" | "rounds" | "seed_hash" | "week_start">,
  results: { matches: readonly MatchRow[]; entries: readonly EntryCardRow[] },
  userId: string,
): Promise<NightRatings | null> {
  if (tournament.status !== "complete" || !tournament.rounds) return null;
  const own = results.entries.filter((row) => row.user_id === userId);
  const played = playedMatches(results.matches, userId);
  if (own.length === 0 || played.length === 0) return null;
  const [events, photoUrls] = await Promise.all([
    supabase
      .schema("kut")
      .from("midweek_events_public")
      .select("*")
      .in(
        "match_id",
        played.map(({ match }) => match.match_id),
      )
      .order("seq"),
    resolvePhotoUrls(
      supabase,
      own.map((row) => row.photo_path),
    ),
  ]);
  if (events.error) throw new Error("Could not load your five's ratings.");
  return nightRatings({
    seedHash: tournament.seed_hash ?? "",
    userId,
    rounds: tournament.rounds,
    weekStart: tournament.week_start,
    matches: results.matches,
    events: (events.data ?? []) as EventRow[],
    entries: results.entries,
    photoUrls,
  });
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

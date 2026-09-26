import type { createClient } from "@/lib/supabase/server";
import type { MidweekTournament, MyRewardRow } from "./entry";
import type { EntryCardRow, MatchRow, PickShareRow } from "./rows";

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

/** The revealed pairings (byes included) and the entered cards of one week. */
export async function loadWeekResults(
  supabase: SupabaseServerClient,
  tournamentId: string,
): Promise<{ matches: MatchRow[]; entries: EntryCardRow[] }> {
  const [matches, entries] = await Promise.all([
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
  ]);
  if (matches.error || entries.error) throw new Error("Could not load this week's results.");
  return {
    matches: (matches.data ?? []) as MatchRow[],
    entries: (entries.data ?? []) as EntryCardRow[],
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

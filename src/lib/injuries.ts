import type { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Injury mode (ADR-082). Whether a Player is injured is decided in SQL — an
 * open period he has not played since — and read here through the
 * `kut.injured_players` projection. Nothing in TypeScript re-derives it.
 */

/**
 * The Players currently in injury mode, for the card badge. The badge is
 * decoration: a failed read (including the schema not being deployed yet)
 * yields an empty set and never fails the page.
 */
export async function fetchInjuredPlayerIds(supabase: SupabaseServerClient): Promise<Set<string>> {
  const { data, error } = await supabase.schema("kut").from("injured_players").select("player_id");
  if (error) {
    console.error("injured players read failed", error);
    return new Set();
  }
  return new Set((data ?? []).map((row: { player_id: string }) => row.player_id));
}

/** The shape `kut.my_injury_status()` returns. */
export type InjuryStatus =
  | { injured: false }
  | {
      injured: true;
      started_on: string;
      /** ISO Monday of the week that can be checked in for now, if any. */
      checkable_week_start: string | null;
      checked_in_this_week: boolean;
      protected_weeks: number;
      stipend: number;
    };

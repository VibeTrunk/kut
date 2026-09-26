import { revealAt } from "@/game/midweek/schedule";
import type { createClient } from "@/lib/supabase/server";
import {
  formatClock,
  isLockedTonight,
  isMidweekVisible,
  isPickingOpen,
  stageName,
  type MidweekCurrent,
  type MidweekTournament,
  type MyRewardRow,
  type MySquadRow,
} from "./entry";
import {
  championLeads,
  liveLine,
  myNight,
  nextMatchNoun,
  revealedRounds,
  revealStops,
  wonRounds,
  type ClockStop,
} from "./evening";
import type { MatchRow } from "./rows";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The Midweek state every entry point shares: the switch, the current
 * tournament and the caller's own saved rows for it.
 *
 * Tolerant by design (ADR-097). Vercel deploys on merge, before a hosted
 * push, and the switch is off until launch, so a missing relation, a failed
 * read or a denied read (zero rows, ADR-079) all mean "Midweek is not showing"
 * and never fail the page that asked. Views are read with `select("*")`, so a
 * column a later migration appends changes nothing here.
 */
export type MidweekEntryState = {
  current: MidweekCurrent;
  /**
   * The caller's saved slots for the current tournament, in slot order; null
   * when the read failed, which is not the same as "not picked".
   */
  squad: MySquadRow[] | null;
};

export async function loadMidweekEntryState(
  supabase: SupabaseServerClient,
): Promise<MidweekEntryState | null> {
  const { data, error } = await supabase
    .schema("kut")
    .from("midweek_current")
    .select("*")
    .maybeSingle();
  if (error) {
    // Expected before the hosted push; loud enough to notice after it.
    console.error("midweek current read failed", error.code, error.message);
    return null;
  }
  const current = (data ?? null) as MidweekCurrent | null;
  if (!isMidweekVisible(current)) return null;
  if (!current.tournament_id) return { current, squad: [] };

  const squadResponse = await supabase
    .schema("kut")
    .from("my_midweek_squad")
    .select("*")
    .eq("tournament_id", current.tournament_id)
    .order("slot");
  if (squadResponse.error) {
    console.error("midweek squad read failed", squadResponse.error.code);
    return { current, squad: null };
  }
  return { current, squad: (squadResponse.data ?? []) as MySquadRow[] };
}

/** A saved card as the entry points draw it: a `MidweekMiniCard`. */
export type EntryMini = {
  rarityTier: "common" | "bronze" | "silver" | "gold" | "holo" | "elite";
  ovr: number;
  injured: boolean;
};

/**
 * What the Home card and the Collection strip show, or null when neither
 * does (disabled, opted out, or a read failed):
 *
 * - `pick`: picking is open (PR 7, ADR-097);
 * - `live`: tonight's week is locked and its rounds are coming out (Home-Live;
 *   the strip's "Your five are playing tonight" while the member is still in);
 * - `final`: after the final, until Thursday 23:59 Amsterdam (owner decision
 *   D4), when Home goes back to the picking prompt. The strip has no such
 *   state and keeps asking for a pick.
 */
export type MidweekEntryPoint =
  | { kind: "pick"; lockAt: string; saved: EntryMini[] }
  | {
      kind: "live";
      title: string;
      line: string;
      stops: ClockStop[] | null;
      /** The Collection strip's "playing tonight" line, while the member is still in. */
      playing: { line: string; mini: EntryMini | null } | null;
    }
  | { kind: "final"; weekStart: string; lockAt: string; title: string; line: string };

export async function loadMidweekEntryPoint(
  supabase: SupabaseServerClient,
  injuredPlayerIds: ReadonlySet<string>,
  now: Date,
  userId: string,
  /** Home follows D4's cutoff; the Collection strip keeps asking for a pick. */
  { withChampion = true }: { withChampion?: boolean } = {},
): Promise<MidweekEntryPoint | null> {
  const state = await loadMidweekEntryState(supabase);
  if (!state || state.squad === null || state.current.opted_out) return null;
  const { current } = state;
  if (!current.lock_at || !current.tournament_id || !current.week_start) return null;

  if (isLockedTonight(current, now)) {
    const saved = await savedMinis(supabase, state.squad, injuredPlayerIds);
    return saved === null ? null : liveEntryPoint(supabase, current, now, userId, saved);
  }

  if (withChampion) {
    const latest = await latestTournaments(supabase, current.week_start);
    if (latest === null) return null;
    const leading = [latest.current, latest.previous].find(
      (tournament) => tournament !== null && championLeads(tournament, now),
    );
    if (leading) return finalEntryPoint(supabase, leading, userId);
  }
  if (!isPickingOpen(current, now)) return null;

  const saved = await savedMinis(supabase, state.squad, injuredPlayerIds);
  return saved === null ? null : { kind: "pick", lockAt: current.lock_at, saved };
}

/** The current tournament's public row and the one before it, for D4. */
async function latestTournaments(
  supabase: SupabaseServerClient,
  currentWeek: string,
): Promise<{ current: MidweekTournament | null; previous: MidweekTournament | null } | null> {
  const { data, error } = await supabase
    .schema("kut")
    .from("midweek_tournaments_public")
    .select("*")
    .lte("week_start", currentWeek)
    .order("week_start", { ascending: false })
    .limit(2);
  if (error) return null;
  const rows = (data ?? []) as MidweekTournament[];
  return {
    current: rows.find((row) => row.week_start === currentWeek) ?? null,
    previous: rows.find((row) => row.week_start < currentWeek) ?? null,
  };
}

/** Home during the evening (Home-Live). */
async function liveEntryPoint(
  supabase: SupabaseServerClient,
  current: MidweekCurrent,
  now: Date,
  userId: string,
  saved: EntryMini[],
): Promise<MidweekEntryPoint | null> {
  const lockAt = current.lock_at as string;
  const roundOne = formatClock(revealAt(new Date(lockAt), 1).toISOString());
  const beforeRoundOne: MidweekEntryPoint = {
    kind: "live",
    title: "Squads are locked",
    line: `Round 1 at ${roundOne}, then a round every half hour.`,
    stops: null,
    playing: saved.length > 0 ? { line: `Round 1 at ${roundOne}.`, mini: saved[0] } : null,
  };
  const rounds = current.rounds;
  if (current.status !== "simulated" || !rounds) return beforeRoundOne;

  const { data, error } = await supabase
    .schema("kut")
    .from("midweek_matches_public")
    .select("*")
    .eq("tournament_id", current.tournament_id as string);
  if (error) return null;
  const matches = (data ?? []) as MatchRow[];
  const out = revealedRounds(matches);
  if (out === 0) {
    return {
      ...beforeRoundOne,
      stops: revealStops({ lockAt, rounds, now, wonRounds: new Set() }).slice(1),
    };
  }

  const night = myNight({ userId, rounds, lockAt, matches });
  const next = night.rows.find((row) => row.kind === "next");
  return {
    kind: "live",
    title: out === rounds ? "The final is out" : `Round ${out} is out`,
    line: liveLine(night, rounds, lockAt),
    stops: revealStops({ lockAt, rounds, now, wonRounds: wonRounds(night) }).slice(1),
    playing:
      next && night.alive
        ? {
            line: `${nextMatchNoun(next.round, rounds)} at ${formatClock(next.revealAt)}.`,
            mini: saved[0] ?? null,
          }
        : null,
  };
}

/** Home after the final, until D4's cutoff. */
async function finalEntryPoint(
  supabase: SupabaseServerClient,
  tournament: MidweekTournament,
  userId: string,
): Promise<MidweekEntryPoint | null> {
  const [rewards, entry] = await Promise.all([
    supabase
      .schema("kut")
      .from("my_midweek_rewards")
      .select("*")
      .eq("tournament_id", tournament.tournament_id),
    supabase
      .schema("kut")
      .from("midweek_entries_public")
      .select("user_id")
      .eq("tournament_id", tournament.tournament_id)
      .eq("user_id", userId)
      .limit(1),
  ]);
  if (rewards.error || entry.error || !tournament.rounds) return null;
  const rows = (rewards.data ?? []) as MyRewardRow[];
  const coins = rows.reduce((sum, row) => sum + Number(row.amount), 0);
  const base = {
    kind: "final" as const,
    weekStart: tournament.week_start,
    lockAt: tournament.lock_at,
  };
  if (tournament.champion_user_id === userId) {
    return {
      ...base,
      title: "You won Midweek Madness",
      line: `+${coins} KUT Coins over the night.`,
    };
  }
  const title = `${tournament.champion_name ?? "Somebody"} won Midweek Madness`;
  if (rows.length > 0) {
    const furthest = Math.max(...rows.map((row) => row.round_no));
    return {
      ...base,
      title,
      line: `You reached ${stageName(furthest + 1, tournament.rounds)}: +${coins} KUT Coins.`,
    };
  }
  const entered = (entry.data ?? []).length > 0;
  return { ...base, title, line: entered ? "You went out in round 1." : "You sat it out." };
}

/** The caller's saved five as minis, or null when the read failed. */
async function savedMinis(
  supabase: SupabaseServerClient,
  squad: MySquadRow[],
  injuredPlayerIds: ReadonlySet<string>,
): Promise<EntryMini[] | null> {
  if (squad.length === 0) return [];

  const { data, error } = await supabase
    .schema("kut")
    .from("my_collection_cards")
    .select("card_id, player_id, is_live, ovr, rarity_tier")
    .in(
      "card_id",
      squad.map((row) => row.card_id),
    );
  if (error) return null;
  const byCard = new Map(
    (
      (data ?? []) as {
        card_id: string;
        player_id: string;
        is_live: boolean;
        ovr: number;
        rarity_tier: EntryMini["rarityTier"];
      }[]
    ).map((row) => [row.card_id, row]),
  );
  // A saved card sold since shows as a trialist on the picker; here it is
  // simply left out.
  return squad.flatMap((row) => {
    const card = byCard.get(row.card_id);
    return card
      ? [
          {
            rarityTier: card.rarity_tier,
            ovr: card.ovr,
            injured: card.is_live && injuredPlayerIds.has(card.player_id),
          },
        ]
      : [];
  });
}

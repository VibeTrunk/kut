import { roundStartAt } from "@/game/midweek/schedule";
import type { createClient } from "@/lib/supabase/server";
import {
  formatClock,
  formatDayDate,
  isLockedTonight,
  isMidweekVisible,
  isPickingOpen,
  roundIntervalText,
  scheduleVersionOf,
  stageName,
  type MidweekCurrent,
  type MidweekTournament,
  type MyRewardRow,
  type MySquadRow,
} from "./entry";
import { championLeads, homeEvening, settledWinner, sideScore, type HomeEvening } from "./evening";
import { reportInputFromRows, renderStoredReport } from "./report/from-db";
import type { Segment } from "./report/types";
import type { LiveScore } from "./live";
import { loadLiveMatch } from "./live-load";
import { loadWeekResults } from "./results";
import type { EntryCardRow, EventRow, MatchRow } from "./rows";

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

/**
 * A match on Home's evening card (Home-Now-Live): a mini scoreboard and one
 * line, the report's headline at full time, or while it plays the latest
 * chance ("39′ Gijs H. finishes…"), as it stood at page load (Q11).
 */
export type HomeMatch = {
  managers: readonly [string, string];
  goals: readonly [number, number];
  penalties: readonly [number, number] | null;
  winnerSide: 0 | 1 | null;
  youSide: 0 | 1 | null;
  auto: readonly [boolean, boolean];
  live: LiveScore | null;
  line: Segment[];
};

/** A saved card as the entry points draw it: a `MidweekMiniCard`. */
export type EntryMini = {
  rarityTier: "common" | "bronze" | "silver" | "gold" | "holo" | "elite";
  ovr: number;
  injured: boolean;
};

/**
 * What the Home card shows, or null when it shows nothing (disabled, opted
 * out, or a read failed):
 *
 * - `pick`: picking is open (PR 7, ADR-097);
 * - `live`: from the lock to the end of the final (Home-Now-Live, ADR-114);
 * - `final`: after the final, until Thursday 23:59 Amsterdam (owner decision
 *   D4), when Home goes back to the picking prompt.
 */
export type MidweekEntryPoint =
  | { kind: "pick"; lockAt: string; saved: EntryMini[] }
  | ({ kind: "live"; match: HomeMatch | null } & Omit<HomeEvening, "match">)
  | { kind: "final"; weekStart: string; lockAt: string; title: string; line: string };

export async function loadMidweekEntryPoint(
  supabase: SupabaseServerClient,
  injuredPlayerIds: ReadonlySet<string>,
  now: Date,
  userId: string,
): Promise<MidweekEntryPoint | null> {
  const state = await loadMidweekEntryState(supabase);
  if (!state || state.squad === null || state.current.opted_out) return null;
  const { current } = state;
  if (!current.lock_at || !current.tournament_id || !current.week_start) return null;

  if (isLockedTonight(current, now)) {
    return liveEntryPoint(supabase, current, now, userId);
  }

  const latest = await latestTournaments(supabase, current.week_start);
  if (latest === null) return null;
  const leading = [latest.current, latest.previous].find(
    (tournament) => tournament !== null && championLeads(tournament, now),
  );
  if (leading) return finalEntryPoint(supabase, leading, userId);
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

/** Home during the evening (Home-Now-Live, ADR-114), as it stood at page load. */
async function liveEntryPoint(
  supabase: SupabaseServerClient,
  current: MidweekCurrent,
  now: Date,
  userId: string,
): Promise<MidweekEntryPoint | null> {
  const lockAt = current.lock_at as string;
  const weekStart = current.week_start as string;
  const scheduleVersion = scheduleVersionOf(current);
  const roundOne = formatClock(roundStartAt(new Date(lockAt), 1, scheduleVersion).toISOString());
  const rounds = current.status === "simulated" ? current.rounds : null;
  if (!rounds) {
    // The lock has passed and the worker hasn't drawn the week yet: a moment at most.
    return {
      kind: "live",
      kicker: `Midweek Madness · ${formatDayDate(lockAt)}`,
      title: "Squads are locked",
      line: `Round 1 at ${roundOne}, then a round ${roundIntervalText(scheduleVersion)}.`,
      match: null,
      button: { label: "Follow the bracket", href: "/midweek" },
    };
  }

  let results: Awaited<ReturnType<typeof loadWeekResults>>;
  try {
    results = await loadWeekResults(supabase, current.tournament_id as string, now);
  } catch (error) {
    console.error("home midweek evening read failed", error);
    return null;
  }
  const evening = homeEvening({
    userId,
    weekStart,
    rounds,
    lockAt,
    scheduleVersion,
    now,
    draw: results.draw,
    matches: results.matches,
  });
  const { match: focus, ...rest } = evening;
  return {
    kind: "live",
    ...rest,
    match: focus
      ? await homeMatch(supabase, current, rounds, focus, results.entries, userId, now)
      : null,
  };
}

/** A full-time match as Home's card draws it: the scoreboard and the report's headline. */
async function homeMatch(
  supabase: SupabaseServerClient,
  current: MidweekCurrent,
  rounds: number,
  match: MatchRow,
  entries: EntryCardRow[],
  userId: string,
  now: Date,
): Promise<HomeMatch | null> {
  const { data, error } = await supabase
    .schema("kut")
    .from("midweek_events_public")
    .select("*")
    .eq("match_id", match.match_id)
    .order("seq");
  if (error) return null;
  const autoOf = (id: string | null) => entries.some((row) => row.user_id === id && row.auto);
  const youSide = match.side_0_user_id === userId ? 0 : match.side_1_user_id === userId ? 1 : null;
  if (match.in_play) {
    const inPlay = await loadLiveMatch(supabase, {
      tournament: { tournament_id: match.tournament_id, seed_hash: current.seed_hash, rounds },
      scheduleVersion: scheduleVersionOf(current),
      match,
      now,
    });
    if (!inPlay) return null;
    const { live } = inPlay;
    const latest = live.timeline.at(-1);
    const lastKick = live.kicks.at(-1);
    return {
      managers: [match.side_0_name, match.side_1_name ?? ""],
      goals: live.score,
      penalties: null,
      winnerSide: null,
      youSide,
      auto: [autoOf(match.side_0_user_id), autoOf(match.side_1_user_id)],
      live: { minute: live.minute, penalties: live.penalties },
      line: lastKick
        ? [
            { text: "Last kick: " },
            { text: lastKick.kicker, side: lastKick.side },
            { text: ` ${lastKick.outcome === "goal" ? "scores" : "misses"}.` },
          ]
        : latest
          ? [{ text: `${latest.minute}′ ` }, ...latest.parts]
          : [{ text: "Kicked off. No chance yet." }],
    };
  }
  const input = reportInputFromRows({
    seedHash: current.seed_hash ?? "",
    rounds,
    match,
    events: (data ?? []) as EventRow[],
    entries,
    ownersPublished: false,
  });
  if (!input) return null;
  const a = sideScore(match, 0);
  const b = sideScore(match, 1);
  return {
    managers: [input.sides[0].manager, input.sides[1].manager],
    goals: [a.goals, b.goals],
    penalties: a.penalties !== null && b.penalties !== null ? [a.penalties, b.penalties] : null,
    winnerSide: settledWinner(match),
    youSide,
    auto: [input.sides[0].auto, input.sides[1].auto],
    live: null,
    line: renderStoredReport(input).headlineParts,
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

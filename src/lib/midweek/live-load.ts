import type { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { liveView, type LiveView } from "./live";
import { reportInputFromRows, renderStoredReport } from "./report/from-db";
import type { MatchReport } from "./report/types";
import type { EntryCardRow, EventRow, MatchRow } from "./rows";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * The live evening's server reads (ADR-115). A match in play is rendered from
 * the stored match, read through the service role, because the report picks
 * its moments and phrases from the whole match: rendered from the events seen
 * so far, a moment would read differently at full time. The page then sends
 * the browser only what is due by now (`liveView`): no later moment, no
 * headline, facts, goals or assists before full time. The member views keep
 * every member's own reads to the clock (ADR-106).
 */

/** Each match's stored end, by match id; empty when the read fails, which shows matches whole. */
export async function loadMatchEnds(tournamentId: string): Promise<Map<string, string | null>> {
  try {
    const { data, error } = await createServiceClient()
      .schema("kut")
      .from("midweek_matches")
      .select("id, ends_at")
      .eq("tournament_id", tournamentId);
    if (error) throw error;
    return new Map(
      ((data ?? []) as { id: string; ends_at: string | null }[]).map((row) => [
        row.id,
        row.ends_at,
      ]),
    );
  } catch (error) {
    console.error("midweek match ends read failed", error);
    return new Map();
  }
}

/**
 * What a page may use of a match in play: what is due by now, and the Why with
 * goals and assists left out until full time (HANDOFF "Matches"). Never the
 * whole report: its headline, facts and later moments would give the result away.
 */
export type LiveMatch = { live: LiveView; why: MatchReport["why"] };

const RESULT_COLUMNS =
  "side_0_goals, side_1_goals, side_0_penalties, side_1_penalties, winner_side, winner_user_id";
const EVENT_COLUMNS =
  "match_id, seq, kind, side, minute, penalty_round, creator_slot, shooter_slot, defender_slot, kicker_slot, keeper_slot, chance_type, outcome, p_goal_ppm";

/**
 * A match in play as it stands at `now`: the whole match's report, and what of
 * it is due. Null when it can't be built (a failed read, or a side's entry not
 * visible), which the page shows as "in play" without the detail.
 */
export async function loadLiveMatch(
  supabase: SupabaseServerClient,
  input: {
    tournament: { tournament_id: string; seed_hash?: string | null; rounds: number };
    scheduleVersion: number;
    match: MatchRow;
    now: Date;
  },
): Promise<LiveMatch | null> {
  const { match } = input;
  if (match.bye || match.side_1_user_id === null) return null;
  try {
    const service = createServiceClient();
    const [stored, events, entries] = await Promise.all([
      service
        .schema("kut")
        .from("midweek_matches")
        .select(RESULT_COLUMNS)
        .eq("id", match.match_id)
        .single(),
      service
        .schema("kut")
        .from("midweek_match_events")
        .select(EVENT_COLUMNS)
        .eq("match_id", match.match_id)
        .order("seq"),
      supabase
        .schema("kut")
        .from("midweek_entries_public")
        .select("*")
        .eq("tournament_id", input.tournament.tournament_id)
        .in("user_id", [match.side_0_user_id, match.side_1_user_id]),
    ]);
    if (stored.error || events.error || entries.error) {
      throw stored.error ?? events.error ?? entries.error;
    }
    const whole = { ...match, ...(stored.data as Partial<MatchRow>) } as MatchRow;
    const reportInput = reportInputFromRows({
      seedHash: input.tournament.seed_hash ?? "",
      rounds: input.tournament.rounds,
      match: whole,
      events: (events.data ?? []) as EventRow[],
      entries: (entries.data ?? []) as EntryCardRow[],
      // Report text is always rendered without owner counts (ADR-098).
      ownersPublished: false,
    });
    if (!reportInput) return null;
    const report = renderStoredReport(reportInput);
    return {
      why: report.why.map((side) => ({
        ...side,
        cards: side.cards.map((card) => ({ ...card, goals: 0, assists: 0 })),
      })) as MatchReport["why"],
      live: liveView({
        timeline: report.timeline,
        kicks: report.shootout?.kicks ?? [],
        kickoffAt: match.reveal_at,
        scheduleVersion: input.scheduleVersion,
        now: input.now,
      }),
    };
  } catch (error) {
    console.error("midweek live match read failed", error);
    return null;
  }
}

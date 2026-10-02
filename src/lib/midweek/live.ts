/**
 * The live evening (MM 2.0 F6, ADR-115; data in ADR-106): which matches are in
 * play, and what a match in play shows at a given moment. Pure and client-safe.
 *
 * Every match unfolds at the same pace (owner decision Q7); a member watches
 * their own match and the final chance by chance, and sees every other match's
 * result at its full time. Nothing here decides a result: the moments, kicks
 * and score come from the stored match's rendered report, revealed by time.
 */

import { MIDWEEK } from "@/game/midweek/config";
import { scheduleFor } from "@/game/midweek/schedule";
import type { ShootoutKick, TimelineItem } from "./report/types";
import type { MatchRow } from "./rows";

/**
 * Withholds the result of every match still in play: goals, penalties and the
 * winner, as ADR-106's view does from its push. Before that push the member
 * view shows whole matches from kick-off, so the page masks them itself from
 * each match's stored end (`ends`, read on the server). A match the view
 * already withholds (no winner) stays in play; a bye never is. With no stored
 * end (a week from before ADR-104) a match shows whole, as it always has.
 */
export function maskInPlay(
  rows: readonly MatchRow[],
  ends: ReadonlyMap<string, string | null>,
  now: Date,
): MatchRow[] {
  return rows.map((row) => {
    if (row.bye) return { ...row, in_play: false };
    const endsAt = row.ends_at ?? ends.get(row.match_id) ?? null;
    const inPlay =
      row.winner_side === null || (endsAt !== null && Date.parse(endsAt) > now.getTime());
    if (!inPlay) return { ...row, in_play: false };
    return {
      ...row,
      side_0_goals: null,
      side_1_goals: null,
      side_0_penalties: null,
      side_1_penalties: null,
      winner_side: null,
      winner_user_id: null,
      in_play: true,
    };
  });
}

/** A match in play on a scoreboard: its running clock, or the shoot-out's tally once it has begun. */
export type LiveScore = { minute: number; penalties: readonly [number, number] | null };

/** A match in play, as it stands at `now`. */
export type LiveView = {
  /** The running match clock, 0′ to 90′ (HANDOFF "Matches", Q10). */
  minute: number;
  /** Goals so far, side 0 first. */
  score: [number, number];
  /** The moments revealed so far, oldest first. */
  timeline: TimelineItem[];
  /** The kicks taken so far, in order; empty before full time. */
  kicks: ShootoutKick[];
  /** Kicks scored so far per side, once the shoot-out has begun. */
  penalties: [number, number] | null;
  /** Past full time and into a shoot-out. */
  shootout: boolean;
};

/**
 * What a member may see of a match in play: the report's moments and kicks up
 * to `now`, each at its stored moment (ADR-104: a chance at kick-off + minute ×
 * 280 s / 90, then a kick every 5 seconds), and the score they add up to. The
 * report is the whole match's, rendered on the server, so a moment reads the
 * same live and at full time; only its time decides whether it shows.
 */
export function liveView(input: {
  timeline: readonly TimelineItem[];
  kicks: readonly ShootoutKick[];
  kickoffAt: string;
  scheduleVersion: number | null;
  now: Date;
}): LiveView {
  const schedule = scheduleFor(input.scheduleVersion);
  const regulationMs = MIDWEEK.match.chanceSlots * schedule.slotSeconds * 1000;
  const kickMs = schedule.kickSeconds * 1000;
  const elapsed = input.now.getTime() - Date.parse(input.kickoffAt);
  const timeline = input.timeline.filter(
    (item) => Math.floor((item.minute * regulationMs) / MIDWEEK.match.minutes) <= elapsed,
  );
  const kicks = input.kicks.filter((_, index) => regulationMs + (index + 1) * kickMs <= elapsed);
  const tally = (side: 0 | 1) =>
    kicks.filter((kick) => kick.side === side && kick.outcome === "goal").length;
  const shootout = input.kicks.length > 0 && elapsed >= regulationMs;
  return {
    minute:
      regulationMs > 0
        ? Math.max(
            0,
            Math.min(
              MIDWEEK.match.minutes,
              Math.floor((elapsed * MIDWEEK.match.minutes) / regulationMs),
            ),
          )
        : MIDWEEK.match.minutes,
    score: timeline.at(-1)?.score ?? [0, 0],
    timeline,
    kicks,
    penalties: shootout ? [tally(0), tally(1)] : null,
    shootout,
  };
}

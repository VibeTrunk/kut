/**
 * Pure helpers for the Midweek Madness evening and results pages (PR 8,
 * ADR-098): the champion's cutoff (owner decision D4), the reveal clock, the
 * bracket, "your night" and the lines the pages print about them.
 *
 * Client-safe: only the engine's schedule and payouts are imported, never
 * `rng.ts` (which needs `node:crypto`). Everything here reads stored results;
 * nothing decides one.
 */

import type { LiveCardPlayer } from "@/components/live-card";
import { isArchetype } from "@/game/archetypes";
import { roundPayouts } from "@/game/midweek/rewards";
import { revealAt } from "@/game/midweek/schedule";
import { ARCHETYPE_OFFSETS, getRarityTier } from "@/game/rating-engine";
import { formatClock } from "./entry";
import type { EntryCardRow, MatchRow } from "./rows";

const AMS = "Europe/Amsterdam";

// ---- names ------------------------------------------------------------------

/** "Round 1", "Quarter-finals", "Semi-finals", "Final": a round header, named from the end. */
export function roundName(round: number, rounds: number): string {
  const fromEnd = rounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semi-finals";
  if (fromEnd === 2) return "Quarter-finals";
  return `Round ${round}`;
}

/** "Round 1", "Quarters", "Semis", "Final": the reveal clock and your night. */
export function roundShort(round: number, rounds: number): string {
  const fromEnd = rounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semis";
  if (fromEnd === 2) return "Quarters";
  return `Round ${round}`;
}

/** "the final", "semi-final 1", "quarter-final 2", "round 1, match 3". */
export function matchName(round: number, pairing: number, rounds: number): string {
  const fromEnd = rounds - round;
  if (fromEnd === 0) return "the final";
  if (fromEnd === 1) return `semi-final ${pairing + 1}`;
  if (fromEnd === 2) return `quarter-final ${pairing + 1}`;
  return `round ${round}, match ${pairing + 1}`;
}

/** "QF 1", "SF 2", "R1 M3": short enough for a bracket cell. */
export function shortMatch(round: number, pairing: number, rounds: number): string {
  const fromEnd = rounds - round;
  if (fromEnd === 1) return `SF ${pairing + 1}`;
  if (fromEnd === 2) return `QF ${pairing + 1}`;
  return `R${round} M${pairing + 1}`;
}

/** The next match you play, as a noun: "Round 2", "Quarter-final", "Semi-final", "The final". */
export function nextMatchNoun(round: number, rounds: number): string {
  const fromEnd = rounds - round;
  if (fromEnd === 0) return "The final";
  if (fromEnd === 1) return "Semi-final";
  if (fromEnd === 2) return "Quarter-final";
  return `Round ${round}`;
}

export const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

// ---- owner decision D4: how long the champion leads ---------------------------

function amsterdamParts(instant: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: AMS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
    second: get("second"),
  };
}

/** Amsterdam's offset from UTC at an instant, in milliseconds. */
function amsterdamOffsetMs(instant: number): number {
  const p = amsterdamParts(instant);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/**
 * Last Wednesday's champion leads `/club/midweek` and the Home card until
 * Thursday 23:59 Europe/Amsterdam (D4); this is the first moment it no longer
 * does, Friday 00:00 in club time. Clocks change at 01:00 UTC on a Sunday,
 * never at a Friday midnight, so the offset at that midnight is the day's.
 */
export function championLeadsUntil(lockAtIso: string): Date {
  const lock = amsterdamParts(Date.parse(lockAtIso));
  const friday = Date.UTC(lock.year, lock.month - 1, lock.day + 2);
  return new Date(friday - amsterdamOffsetMs(friday - 2 * 60 * 60 * 1000));
}

/** Whether a tournament's champion still leads (D4): complete, and before its cutoff. */
export function championLeads(tournament: { status: string; lock_at: string }, now: Date): boolean {
  return (
    tournament.status === "complete" &&
    now.getTime() < championLeadsUntil(tournament.lock_at).getTime()
  );
}

// ---- the reveal clock -------------------------------------------------------------

export type ClockStop = {
  time: string;
  name: string;
  state: "lock" | "done" | "next" | "hidden";
  /** Set on a round the member won (a bye included): a halo on the stop. */
  you: boolean;
  /** The round this stop reveals; null for the lock. */
  round: number | null;
};

/** `MidweekRevealClock`'s stops: the lock, then one per round, out, next or hidden. */
export function revealStops(input: {
  lockAt: string;
  rounds: number;
  now: Date;
  wonRounds: ReadonlySet<number>;
}): ClockStop[] {
  const lock = new Date(input.lockAt);
  const stops: ClockStop[] = [
    { time: formatClock(input.lockAt), name: "Lock", state: "lock", you: false, round: null },
  ];
  let nextGiven = false;
  for (let round = 1; round <= input.rounds; round += 1) {
    const at = revealAt(lock, round);
    const out = at.getTime() <= input.now.getTime();
    const state = out ? "done" : nextGiven ? "hidden" : "next";
    if (!out) nextGiven = true;
    stops.push({
      time: formatClock(at.toISOString()),
      name: roundShort(round, input.rounds),
      state,
      you: input.wonRounds.has(round),
      round,
    });
  }
  return stops;
}

/** How many rounds are out: every round at least one of whose pairings is visible. */
export function revealedRounds(matches: readonly Pick<MatchRow, "round">[]): number {
  return matches.reduce((most, match) => Math.max(most, match.round), 0);
}

// ---- the bracket ---------------------------------------------------------------------

export const winnerName = (match: MatchRow) =>
  match.winner_side === 0 ? match.side_0_name : (match.side_1_name ?? match.side_0_name);

export type BracketSlot = { userId: string | null; name: string; auto: boolean };

export type BracketPair =
  | {
      kind: "match";
      round: number;
      pairing: number;
      match: MatchRow;
      sides: [BracketSlot, BracketSlot];
    }
  | { kind: "bye"; round: number; pairing: number; match: MatchRow; sides: [BracketSlot] }
  /** Not revealed yet: the two who meet, when the round before is out, or where they come from. */
  | {
      kind: "hidden";
      round: number;
      pairing: number;
      known: boolean;
      sides: [BracketSlot, BracketSlot];
    };

export type BracketRound = {
  round: number;
  name: string;
  revealAt: string;
  revealed: boolean;
  pairs: BracketPair[];
};

/**
 * Every pairing of every round, from the revealed rows (§44.6: the winners of
 * pairings 2k and 2k + 1 meet in pairing k of the next round). A round whose
 * rows aren't visible yet is laid out from the round before: its sides when
 * that round is out, otherwise "Winner, QF 1".
 */
export function assembleBracket(input: {
  rounds: number;
  lockAt: string;
  matches: readonly MatchRow[];
  autoUserIds: ReadonlySet<string>;
}): BracketRound[] {
  const { rounds } = input;
  const lock = new Date(input.lockAt);
  const byKey = new Map(input.matches.map((match) => [`${match.round}/${match.pairing}`, match]));
  const slot = (userId: string | null, name: string): BracketSlot => ({
    userId,
    name,
    auto: userId !== null && input.autoUserIds.has(userId),
  });
  const result: BracketRound[] = [];
  for (let round = 1; round <= rounds; round += 1) {
    const count = 2 ** (rounds - round);
    const revealed = input.matches.some((match) => match.round === round);
    const pairs: BracketPair[] = [];
    for (let pairing = 0; pairing < count; pairing += 1) {
      const match = byKey.get(`${round}/${pairing}`);
      if (match?.bye) {
        pairs.push({
          kind: "bye",
          round,
          pairing,
          match,
          sides: [slot(match.side_0_user_id, match.side_0_name)],
        });
        continue;
      }
      if (match && match.side_1_user_id !== null) {
        pairs.push({
          kind: "match",
          round,
          pairing,
          match,
          sides: [
            slot(match.side_0_user_id, match.side_0_name),
            slot(match.side_1_user_id, match.side_1_name ?? ""),
          ],
        });
        continue;
      }
      const feeders = [2 * pairing, 2 * pairing + 1].map((p) => byKey.get(`${round - 1}/${p}`));
      const known = round > 1 && feeders.every((feeder) => feeder !== undefined);
      pairs.push({
        kind: "hidden",
        round,
        pairing,
        known,
        sides: feeders.map((feeder, index) =>
          known && feeder
            ? slot(feeder.winner_user_id, winnerName(feeder))
            : slot(
                null,
                round > 1
                  ? `Winner, ${shortMatch(round - 1, 2 * pairing + index, rounds)}`
                  : "To be drawn",
              ),
        ) as [BracketSlot, BracketSlot],
      });
    }
    result.push({
      round,
      name: roundName(round, rounds),
      revealAt: revealAt(lock, round).toISOString(),
      revealed,
      pairs,
    });
  }
  return result;
}

/** A played match's score for one side, "2" or "2 (7)" with penalties. */
export function sideScore(
  match: MatchRow,
  side: 0 | 1,
): { goals: number; penalties: number | null } {
  return {
    goals: (side === 0 ? match.side_0_goals : match.side_1_goals) ?? 0,
    penalties: side === 0 ? match.side_0_penalties : match.side_1_penalties,
  };
}

/** `MidweekMatchRow`'s accessible sentence: "Julia 1, Stijn 1, 5–4 on penalties. Julia won." */
export function matchSentence(match: MatchRow): string {
  if (match.bye) return `${match.side_0_name} has a bye. A bye counts as a win.`;
  const a = sideScore(match, 0);
  const b = sideScore(match, 1);
  const pens =
    a.penalties !== null && b.penalties !== null
      ? `, ${a.penalties}–${b.penalties} on penalties`
      : "";
  return `${match.side_0_name} ${a.goals}, ${match.side_1_name} ${b.goals}${pens}. ${winnerName(match)} won.`;
}

// ---- your night ------------------------------------------------------------------------

export type PathRow =
  | { kind: "bye"; round: number; revealAt: string; coins: number }
  | {
      kind: "won" | "out";
      round: number;
      revealAt: string;
      opponent: string;
      /** Your side's score first: "1–0", "2–2, 6–7 on penalties". */
      score: string;
      penalties: boolean;
      matchId: string;
      coins: number;
    }
  | { kind: "next"; round: number; revealAt: string; opponent: string | null; coins: number };

export type MyNight = {
  rows: PathRow[];
  /** Coins won so far (byes included): paid after the final (§44.7). */
  coins: number;
  /** Still in: no loss revealed. */
  alive: boolean;
  /** The member plays in the revealed bracket. */
  entered: boolean;
  champion: boolean;
};

/**
 * "Your night" (`MidweekPath`): one row per revealed round you played, then a
 * "Next" row while you are still in and the next round isn't out. Coins come
 * from `roundPayouts`, as display only: payment happens after the final.
 */
export function myNight(input: {
  userId: string;
  rounds: number;
  lockAt: string;
  matches: readonly MatchRow[];
}): MyNight {
  const { rounds, userId } = input;
  const lock = new Date(input.lockAt);
  const pays = roundPayouts(rounds);
  const rows: PathRow[] = [];
  let coins = 0;
  let alive = true;
  for (let round = 1; round <= rounds; round += 1) {
    const match = input.matches.find(
      (m) => m.round === round && (m.side_0_user_id === userId || m.side_1_user_id === userId),
    );
    if (!match) break;
    const at = revealAt(lock, round).toISOString();
    if (match.bye) {
      rows.push({ kind: "bye", round, revealAt: at, coins: pays[round - 1] });
      coins += pays[round - 1];
      continue;
    }
    const mine: 0 | 1 = match.side_0_user_id === userId ? 0 : 1;
    const theirs: 0 | 1 = mine === 0 ? 1 : 0;
    const me = sideScore(match, mine);
    const them = sideScore(match, theirs);
    const penalties = me.penalties !== null && them.penalties !== null;
    const won = match.winner_side === mine;
    rows.push({
      kind: won ? "won" : "out",
      round,
      revealAt: at,
      opponent: (theirs === 0 ? match.side_0_name : match.side_1_name) ?? "",
      score: `${me.goals}–${them.goals}${penalties ? `, ${me.penalties}–${them.penalties} on penalties` : ""}`,
      penalties,
      matchId: match.match_id,
      coins: won ? pays[round - 1] : 0,
    });
    if (!won) {
      alive = false;
      break;
    }
    coins += pays[round - 1];
  }
  const entered = rows.length > 0;
  const last = rows.at(-1);
  if (entered && alive && last && last.round < rounds) {
    const round = last.round + 1;
    const lastMatch = input.matches.find(
      (m) => m.round === last.round && (m.side_0_user_id === userId || m.side_1_user_id === userId),
    );
    // Your next opponent won the neighbouring pairing (§44.6), revealed with yours.
    const sibling = lastMatch
      ? input.matches.find((m) => m.round === last.round && m.pairing === (lastMatch.pairing ^ 1))
      : undefined;
    rows.push({
      kind: "next",
      round,
      revealAt: revealAt(lock, round).toISOString(),
      opponent: sibling ? winnerName(sibling) : null,
      coins: pays[round - 1],
    });
  }
  const champion =
    entered && alive && last !== undefined && last.round === rounds && last.kind === "won";
  return { rows, coins, alive, entered, champion };
}

/** The rounds the member won, for the clock's halo. */
export function wonRounds(night: MyNight): Set<number> {
  return new Set(
    night.rows.filter((row) => row.kind === "won" || row.kind === "bye").map((row) => row.round),
  );
}

/** "Quarters" and "out on penalties", "Champion", or "Round 1" and "out": the Week-Complete stat. */
export function finishStat(night: MyNight, rounds: number): { value: string; note: string } {
  if (!night.entered) return { value: "—", note: "sat it out" };
  if (night.champion) return { value: "Champion", note: "won the final" };
  const out = night.rows.find((row) => row.kind === "out");
  if (!out || out.kind !== "out") return { value: "—", note: "still in" };
  return {
    value: roundShort(out.round, rounds),
    note: out.penalties ? "out on penalties" : "out",
  };
}

/**
 * The Home card during the evening (Home-Live): your latest result and what
 * happens next. "You beat Eline 1–0. Quarter-final against Sophie at 21:30."
 */
export function liveLine(night: MyNight, rounds: number, lockAt: string): string {
  const finalAt = formatClock(revealAt(new Date(lockAt), rounds).toISOString());
  const played = night.rows.filter((row) => row.kind !== "next");
  const last = played.at(-1);
  const next = night.rows.find((row) => row.kind === "next");
  const nextText =
    next && next.kind === "next"
      ? ` ${nextMatchNoun(next.round, rounds)}${next.opponent ? ` against ${next.opponent}` : ""} at ${formatClock(next.revealAt)}.`
      : "";
  if (!last) return `The final is at ${finalAt}.`;
  if (last.kind === "bye") return `You had a bye.${nextText}`;
  if (last.kind === "won") {
    return night.champion
      ? `You won the final, ${last.score}.`
      : `You beat ${last.opponent} ${last.score}.${nextText}`;
  }
  if (last.kind === "out") {
    const how = last.penalties ? " on penalties" : `, ${last.score}`;
    const final = last.round < rounds ? ` The final is at ${finalAt}.` : "";
    return `You went out to ${last.opponent}${how}.${final}`;
  }
  return "";
}

/**
 * The champion hero's line (Week-Complete): "Beat Sophie on penalties in the
 * final, 2–2 and 7–6 from the spot." The champion's numbers come first.
 */
export function finalLine(final: MatchRow): string {
  const winner = final.winner_side;
  const loser: 0 | 1 = winner === 0 ? 1 : 0;
  const opponent = (loser === 0 ? final.side_0_name : final.side_1_name) ?? "";
  const w = sideScore(final, winner);
  const l = sideScore(final, loser);
  if (w.penalties !== null && l.penalties !== null) {
    return `Beat ${opponent} on penalties in the final, ${w.goals}–${l.goals} and ${w.penalties}–${l.penalties} from the spot.`;
  }
  return `Beat ${opponent} in the final, ${w.goals}–${l.goals}.`;
}

/** The club's night in numbers (Week-Complete): goals in played matches, and coins across the bracket. */
export function nightTotals(matches: readonly MatchRow[], rounds: number) {
  const pays = roundPayouts(rounds);
  const played = matches.filter((match) => !match.bye);
  return {
    goals: played.reduce((sum, m) => sum + (m.side_0_goals ?? 0) + (m.side_1_goals ?? 0), 0),
    matches: played.length,
    coins: matches.reduce((sum, match) => sum + pays[match.round - 1], 0),
  };
}

/** Entrants and auto squads, from the entries (one row per card). */
export function fieldCounts(entries: readonly Pick<EntryCardRow, "user_id" | "auto">[]) {
  const byUser = new Map(entries.map((row) => [row.user_id, row.auto]));
  return {
    entrants: byUser.size,
    auto: [...byUser.values()].filter(Boolean).length,
  };
}

/** A handicap as the "why" panel prints it: three decimals, so 0.575 isn't rounded (HANDOFF question 10). */
export function handicapText(ppm: number): string {
  return (ppm / 1_000_000).toFixed(3);
}

/** A week-long factor at two decimals, with its direction away from 1.00. */
export function factorText(ppm: number): { text: string; trend: "up" | "down" | "flat" } {
  const value = ppm / 1_000_000;
  const text = value.toFixed(2);
  return { text, trend: text === "1.00" ? "flat" : value > 1 ? "up" : "down" };
}

/** Whether a URL segment is an ISO Monday ("2026-10-05"), checked before it reaches a query. */
export function isWeekStart(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    date.getUTCDay() === 1
  );
}

/**
 * A lock-time entered card as a `LiveCard` (HANDOFF "Champion's five"): the
 * locked OVR and archetype, attributes as OVR plus the archetype's offsets, the
 * tier from the locked OVR, and the cast from the injury flag at the lock, so
 * the card shows what the engine used rather than today's rating or injury.
 */
export function entryCardFace(
  row: Pick<
    EntryCardRow,
    "player_id" | "player_name" | "ovr" | "archetype" | "injured" | "photo_path"
  >,
  photoUrls: ReadonlyMap<string, string>,
): LiveCardPlayer | null {
  if (row.player_id === null || row.player_name === null) return null;
  const offsets = ARCHETYPE_OFFSETS[isArchetype(row.archetype) ? row.archetype : "all_rounder"];
  const attribute = (offset: number) => Math.min(99, Math.max(1, row.ovr + offset));
  return {
    id: row.player_id,
    injured: row.injured,
    displayName: row.player_name,
    archetype: row.archetype,
    liveOvr: row.ovr,
    pac: attribute(offsets.pac),
    sho: attribute(offsets.sho),
    pas: attribute(offsets.pas),
    dri: attribute(offsets.dri),
    def: attribute(offsets.def),
    phy: attribute(offsets.phy),
    rarityTier: getRarityTier(row.ovr),
    photoUrl: row.photo_path ? (photoUrls.get(row.photo_path) ?? null) : null,
  };
}

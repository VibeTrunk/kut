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
import { archetypeLabel, isArchetype } from "@/game/archetypes";
import { roundPayouts } from "@/game/midweek/rewards";
import { roundStartAt } from "@/game/midweek/schedule";
import { ARCHETYPE_OFFSETS, getRarityTier } from "@/game/rating-engine";
import {
  formatClock,
  formatDayDate,
  stageName,
  type MidweekTournament,
  type MyRewardRow,
} from "./entry";
import type { DrawRow, EntryCardRow, MatchRow } from "./rows";

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
 * Last Wednesday's champion leads `/midweek` and the Home card until
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

// ---- the bracket ---------------------------------------------------------------------

export const winnerName = (match: MatchRow) =>
  match.winner_side === 0 ? match.side_0_name : (match.side_1_name ?? match.side_0_name);

/**
 * Whether a revealed pairing is at full time: a bye always is, and a match once
 * its result shows. Matches are revealed whole at kick-off until ADR-106, so
 * today every visible match is; from then a row without a result is still
 * being played.
 */
export const atFullTime = (match: MatchRow) => match.bye || match.winner_side != null;

export type BracketSlot = {
  userId: string | null;
  name: string;
  auto: boolean;
  /** Not settled yet: "Winner of Mila v Eline", "Winner, Quarters 1". */
  placeholder: boolean;
};

export type BracketPair =
  | {
      kind: "played";
      round: number;
      pairing: number;
      match: MatchRow;
      sides: [BracketSlot, BracketSlot];
    }
  | { kind: "bye"; round: number; pairing: number; sides: [BracketSlot] }
  /** Not kicked off yet: the two who meet, or where they come from. */
  | {
      kind: "upcoming";
      round: number;
      pairing: number;
      kickoffAt: string;
      sides: [BracketSlot, BracketSlot];
    };

export type BracketRound = {
  round: number;
  name: string;
  kickoffAt: string;
  /** Every pairing is at full time (byes always are). */
  played: boolean;
  pairs: BracketPair[];
};

/** "Quarters 1", "Semis 2", "R2 M3": where a later round's entrant comes from. */
export function feederName(round: number, pairing: number, rounds: number): string {
  const fromEnd = rounds - round;
  if (fromEnd === 1) return `Semis ${pairing + 1}`;
  if (fromEnd === 2) return `Quarters ${pairing + 1}`;
  return `R${round} M${pairing + 1}`;
}

/**
 * Every pairing of every round (§44.6: the winners of pairings 2k and 2k + 1
 * meet in pairing k of the next round), from round 1's draw (from the lock,
 * ADR-105) and the pairings revealed so far. A pairing not at full time is
 * `upcoming` with its kick-off: round 2 names a match still to be played as
 * "Winner of Mila v Eline", later rounds "Winner, Quarters 1" (HANDOFF
 * "Bracket").
 */
export function assembleBracket(input: {
  rounds: number;
  lockAt: string;
  scheduleVersion: number;
  draw?: readonly DrawRow[];
  matches: readonly MatchRow[];
  autoUserIds: ReadonlySet<string>;
}): BracketRound[] {
  const { rounds } = input;
  const lock = new Date(input.lockAt);
  const byKey = new Map(input.matches.map((match) => [`${match.round}/${match.pairing}`, match]));
  const drawn = new Map((input.draw ?? []).map((row) => [row.pairing, row]));
  const slot = (userId: string | null, name: string, placeholder = false): BracketSlot => ({
    userId,
    name,
    placeholder,
    auto: !placeholder && userId !== null && input.autoUserIds.has(userId),
  });
  const result: BracketRound[] = [];
  for (let round = 1; round <= rounds; round += 1) {
    const kickoffAt = roundStartAt(lock, round, input.scheduleVersion).toISOString();
    const count = 2 ** (rounds - round);
    const before = result[round - 2];
    const fromFeeder = (pairing: number): BracketSlot => {
      const feeder = before?.pairs[pairing];
      if (feeder?.kind === "bye") return { ...feeder.sides[0] };
      if (feeder?.kind === "played") {
        return slot(feeder.match.winner_user_id, winnerName(feeder.match));
      }
      if (round === 2 && feeder && !feeder.sides.some((side) => side.placeholder)) {
        return slot(null, `Winner of ${feeder.sides[0].name} v ${feeder.sides[1].name}`, true);
      }
      return slot(
        null,
        round > 1 ? `Winner, ${feederName(round - 1, pairing, rounds)}` : "To be drawn",
        true,
      );
    };
    const pairs: BracketPair[] = [];
    for (let pairing = 0; pairing < count; pairing += 1) {
      const match = byKey.get(`${round}/${pairing}`);
      const source = match ?? (round === 1 ? drawn.get(pairing) : undefined);
      if (source?.bye) {
        pairs.push({
          kind: "bye",
          round,
          pairing,
          sides: [slot(source.side_0_user_id, source.side_0_name)],
        });
        continue;
      }
      if (match && match.side_1_user_id !== null && atFullTime(match)) {
        pairs.push({
          kind: "played",
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
      pairs.push({
        kind: "upcoming",
        round,
        pairing,
        kickoffAt,
        sides:
          source && source.side_1_user_id !== null
            ? [
                slot(source.side_0_user_id, source.side_0_name),
                slot(source.side_1_user_id, source.side_1_name ?? ""),
              ]
            : [fromFeeder(2 * pairing), fromFeeder(2 * pairing + 1)],
      });
    }
    result.push({
      round,
      name: roundName(round, rounds),
      kickoffAt,
      played: pairs.every((pair) => pair.kind !== "upcoming"),
      pairs,
    });
  }
  return result;
}

/**
 * The round of the member's next match still to kick off, for the jump link
 * "Your match · R2 20:15"; null once they are out or have no match left.
 */
export function yourNextRound(bracket: readonly BracketRound[], you: string): BracketRound | null {
  return (
    bracket.find((round) =>
      round.pairs.some(
        (pair) =>
          pair.kind === "upcoming" &&
          pair.sides.some((side) => !side.placeholder && side.userId === you),
      ),
    ) ?? null
  );
}

/**
 * Where a group of pairings sits in the `lg` bracket tree (KB-031). The tree is
 * one grid shared by every round: a header row, then `2^(rounds − 1)` rows of
 * equal height, one per round-1 pairing. A round-`r` pairing spans `2^(r − 1)`
 * rows, so it is centred exactly between the two pairings that feed it, whatever
 * each of them holds (a bye is one line, a match two). Rows are 1-based and
 * include the header row.
 */
export function treeGroupRows(
  round: number,
  group: number,
  size: number,
): { rowStart: number; rowSpan: number } {
  const span = 2 ** (round - 1);
  return { rowStart: 2 + group * 2 * span, rowSpan: size * span };
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

/** A played match in one sentence: "Julia 1, Stijn 1, 5–4 on penalties. Julia won." */
export function matchSentence(match: MatchRow): string {
  if (match.bye) return `${match.side_0_name} has a bye, which counts as a win.`;
  const a = sideScore(match, 0);
  const b = sideScore(match, 1);
  const pens =
    a.penalties !== null && b.penalties !== null
      ? `, ${a.penalties}–${b.penalties} on penalties`
      : "";
  return `${match.side_0_name} ${a.goals}, ${match.side_1_name} ${b.goals}${pens}. ${winnerName(match)} won.`;
}

/** `MidweekMatchRow`'s accessible sentence, in every state. */
export function pairSentence(pair: BracketPair): string {
  if (pair.kind === "played") return matchSentence(pair.match);
  if (pair.kind === "bye") return `${pair.sides[0].name} has a bye, which counts as a win.`;
  return `${pair.sides[0].name} v ${pair.sides[1].name}, kick-off ${formatClock(pair.kickoffAt)}.`;
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
  scheduleVersion: number;
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
    const at = roundStartAt(lock, round, input.scheduleVersion).toISOString();
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
      revealAt: roundStartAt(lock, round, input.scheduleVersion).toISOString(),
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
export function liveLine(
  night: MyNight,
  rounds: number,
  lockAt: string,
  scheduleVersion: number,
): string {
  const finalAt = formatClock(
    roundStartAt(new Date(lockAt), rounds, scheduleVersion).toISOString(),
  );
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

// ---- the evening from the lock (MM 2.0 F5, ADR-113) ------------------------------

export type StopState = "locked" | "played" | "live" | "next" | "later";

/** The words `MidweekClock` prints under each stop. */
export const STOP_WORD: Record<StopState, string> = {
  locked: "Locked",
  played: "Played",
  live: "Live",
  next: "Next",
  later: "Later",
};

export type EveningStop = {
  time: string;
  name: string;
  state: StopState;
  /** A round the member is still in (or went out in): a brass dot after its name. */
  you: boolean;
  /** Null for the lock. */
  round: number | null;
};

/**
 * `MidweekClock`'s stops (HANDOFF "Midweek: the evening"): the lock, then one
 * per round. A round is `played` once every one of its pairings is at full
 * time, `live` from its kick-off until then, and of the rounds still to come
 * the first is `next` and the rest `later`. Today a match shows whole at its
 * kick-off, so a round goes straight to `played`; with ADR-106 a round shows
 * `live` while it plays, with no change here.
 */
export function eveningStops(input: {
  lockAt: string;
  scheduleVersion: number;
  rounds: number;
  now: Date;
  matches: readonly MatchRow[];
  /** The last round the member is in (`roundsYouAreIn`), or null. */
  youThrough: number | null;
}): EveningStop[] {
  const lock = new Date(input.lockAt);
  const now = input.now.getTime();
  let nextGiven = lock.getTime() > now;
  const stops: EveningStop[] = [
    {
      time: formatClock(input.lockAt),
      name: "Lock",
      state: nextGiven ? "next" : "locked",
      you: false,
      round: null,
    },
  ];
  for (let round = 1; round <= input.rounds; round += 1) {
    const at = roundStartAt(lock, round, input.scheduleVersion);
    const pairings = 2 ** (input.rounds - round);
    const done = input.matches.filter((match) => match.round === round && atFullTime(match));
    let state: StopState;
    if (at.getTime() <= now) state = done.length === pairings ? "played" : "live";
    else if (!nextGiven) {
      state = "next";
      nextGiven = true;
    } else state = "later";
    stops.push({
      time: formatClock(at.toISOString()),
      name: roundShort(round, input.rounds),
      state,
      you: input.youThrough !== null && round <= input.youThrough,
      round,
    });
  }
  return stops;
}

/** The clock as one sentence for screen readers. */
export function eveningClockLabel(stops: readonly EveningStop[]): string {
  const parts = stops.map(
    (stop) =>
      `${stop.name} ${stop.time}, ${STOP_WORD[stop.state].toLowerCase()}${stop.you ? ", you're in" : ""}`,
  );
  return `Wednesday evening: ${parts.join("; ")}.`;
}

/**
 * The last round the member plays in tonight: the round they went out in, or
 * the final while they are still in; null when they aren't entered.
 */
export function roundsYouAreIn(night: MyNight, entered: boolean, rounds: number): number | null {
  if (!entered) return null;
  const out = night.rows.find((row) => row.kind === "out");
  return out ? out.round : rounds;
}

export type EveningPhase = {
  /**
   * `draw` from the lock to round 1 (Evening-Draw); `round` while the member is
   * still in, or isn't entered; `out` once they have lost (Evening-Out);
   * `final` from the final's kick-off, for everyone.
   */
  kind: "draw" | "round" | "out" | "final";
  /** The latest round that has kicked off; 0 before round 1. */
  round: number;
  title: string;
};

/** Which evening page to show, and its title (HANDOFF "Titles"). */
export function eveningPhase(input: {
  rounds: number;
  lockAt: string;
  scheduleVersion: number;
  now: Date;
  night: MyNight;
}): EveningPhase {
  const lock = new Date(input.lockAt);
  let round = 0;
  while (
    round < input.rounds &&
    roundStartAt(lock, round + 1, input.scheduleVersion).getTime() <= input.now.getTime()
  ) {
    round += 1;
  }
  if (round === 0) return { kind: "draw", round, title: "The draw is out" };
  if (round === input.rounds) return { kind: "final", round, title: "The final is live" };
  if (input.night.entered && !input.night.alive) {
    return { kind: "out", round, title: "You’re out" };
  }
  const name = roundName(round, input.rounds);
  return { kind: "round", round, title: `${name} ${name.endsWith("finals") ? "are" : "is"} live` };
}

export type FirstMatch = {
  round: number;
  kickoffAt: string;
  /** "Round 1 is a bye for you, … In the semi-finals you meet the winner of Mila v Eline." */
  text: string;
  /** Who the member meets: one, or both possible opponents after a bye. */
  opponentIds: string[];
};

/**
 * "Your first match" on the draw (Evening-Draw), from round 1 as drawn at the
 * lock: the opponent, or after a bye the neighbouring pairing's two, whose
 * winner the member meets in round 2 (§44.6).
 */
export function firstMatch(input: {
  userId: string;
  draw: readonly DrawRow[];
  rounds: number;
  lockAt: string;
  scheduleVersion: number;
}): FirstMatch | null {
  const mine = input.draw.find(
    (row) => row.side_0_user_id === input.userId || row.side_1_user_id === input.userId,
  );
  if (!mine) return null;
  const lock = new Date(input.lockAt);
  if (!mine.bye) {
    const kickoffAt = roundStartAt(lock, 1, input.scheduleVersion).toISOString();
    const theirs = mine.side_0_user_id === input.userId ? 1 : 0;
    const name = (theirs === 0 ? mine.side_0_name : mine.side_1_name) ?? "";
    const id = theirs === 0 ? mine.side_0_user_id : mine.side_1_user_id;
    return {
      round: 1,
      kickoffAt,
      text: `You meet ${name} at ${formatClock(kickoffAt)}.`,
      opponentIds: id ? [id] : [],
    };
  }
  const kickoffAt = roundStartAt(lock, 2, input.scheduleVersion).toISOString();
  const lead = `Round 1 is a bye for you, which counts as a win (+${roundPayouts(input.rounds)[0]}).`;
  const stage = stageName(2, input.rounds);
  const neighbour = input.draw.find((row) => row.pairing === (mine.pairing ^ 1));
  if (!neighbour) return { round: 2, kickoffAt, text: lead, opponentIds: [] };
  if (neighbour.bye || neighbour.side_1_user_id === null) {
    return {
      round: 2,
      kickoffAt,
      text: `${lead} In ${stage} you meet ${neighbour.side_0_name}.`,
      opponentIds: [neighbour.side_0_user_id],
    };
  }
  return {
    round: 2,
    kickoffAt,
    text: `${lead} In ${stage} you meet the winner of ${neighbour.side_0_name} v ${neighbour.side_1_name}.`,
    opponentIds: [neighbour.side_0_user_id, neighbour.side_1_user_id],
  };
}

export const TIER_LABEL: Record<LiveCardPlayer["rarityTier"], string> = {
  common: "Common",
  bronze: "Bronze",
  silver: "Silver",
  gold: "Gold",
  holo: "Holo",
  elite: "Elite",
};

export type FiveCard = {
  slot: number;
  name: string;
  /** "All-rounder · Bronze · 40 · in goal". */
  detail: string;
  /** The mini card; null for a trialist. */
  mini: { rarityTier: LiveCardPlayer["rarityTier"]; ovr: number; injured: boolean } | null;
};

export type FiveView = {
  userId: string;
  manager: string;
  auto: boolean;
  cards: FiveCard[];
};

/**
 * An entered five as `MidweekFiveList` shows it on the draw: each card's
 * lock-time OVR, archetype and tier, the keeper and the injury cast, never the
 * week's dice (ADR-105).
 */
export function fiveOf(entries: readonly EntryCardRow[], userId: string): FiveView | null {
  const rows = entries.filter((row) => row.user_id === userId).sort((a, b) => a.slot - b.slot);
  if (rows.length === 0) return null;
  return {
    userId,
    manager: rows[0].manager_name,
    auto: rows[0].auto,
    cards: rows.map((row) => {
      const inGoal = row.slot === row.keeper_slot ? " · in goal" : "";
      if (row.trialist || row.player_name === null) {
        return {
          slot: row.slot,
          name: "Trialist",
          detail: `Common ${archetypeLabel(row.archetype)} · ${row.ovr}${inGoal}`,
          mini: null,
        };
      }
      const tier = getRarityTier(row.ovr);
      return {
        slot: row.slot,
        name: row.player_name,
        detail: `${archetypeLabel(row.archetype)} · ${TIER_LABEL[tier]} · ${row.ovr}${inGoal}`,
        mini: { rarityTier: tier, ovr: row.ovr, injured: row.injured },
      };
    }),
  };
}

export type PastWeek = { weekStart: string; date: string; text: string };

/**
 * `/midweek/past` (`MidweekWeekList`): one row per finished week, newest
 * first: who won, the field and how the member did, or why nothing was played.
 * Open and running weeks are left out.
 */
export function pastWeeks(input: {
  tournaments: readonly MidweekTournament[];
  entrants: readonly { tournament_id: string; user_id: string }[];
  rewards: readonly MyRewardRow[];
  userId: string;
  minEntrants: number;
}): PastWeek[] {
  return [...input.tournaments]
    .filter((week) => ["complete", "skipped", "void"].includes(week.status))
    .sort((a, b) => (a.week_start < b.week_start ? 1 : -1))
    .map((week) => {
      const base = { weekStart: week.week_start, date: formatDayDate(week.lock_at) };
      if (week.status === "void") {
        return { ...base, text: "Called off by an admin. No results, and nothing paid." };
      }
      if (week.status === "skipped") {
        return {
          ...base,
          text:
            week.status_reason === "club_break"
              ? "No Midweek Madness: the club was on a break. Nothing played or paid."
              : `No Midweek Madness: fewer than ${input.minEntrants} clubs were in. Nothing played or paid.`,
        };
      }
      const field = input.entrants.filter((row) => row.tournament_id === week.tournament_id);
      const mine = input.rewards.filter((row) => row.tournament_id === week.tournament_id);
      const coins = mine.reduce((sum, row) => sum + Number(row.amount), 0);
      let you: string;
      if (week.champion_user_id === input.userId) you = `You: champion, +${coins}.`;
      else if (mine.length > 0 && week.rounds) {
        const furthest = Math.max(...mine.map((row) => row.round_no));
        you = `You: ${stageName(furthest + 1, week.rounds).replace(/^the /, "")}, +${coins}.`;
      } else if (field.some((row) => row.user_id === input.userId) && week.rounds) {
        you = `You: ${stageName(1, week.rounds).replace(/^the /, "")}.`;
      } else you = "You sat it out.";
      return {
        ...base,
        text: `${week.champion_name ?? "Somebody"} won it · ${field.length} entrants. ${you}`,
      };
    });
}

// ---- Home's evening card (MM 2.0 F4, ADR-114) ------------------------------------

export type HomeEvening = {
  /** "Midweek Madness · Quarter-finals". */
  kicker: string;
  /** Shown when there is no match to put on the card. */
  title: string;
  line: string;
  /**
   * The match the card shows as a scoreboard with its headline: your match in
   * the round now playing, or the final from its kick-off. Only at full time:
   * until ADR-106 every visible match is, and a match in play is F6's.
   */
  match: MatchRow | null;
  button: { label: string; href: string };
};

/**
 * Home's live card during the evening (design/ux-review `Home-Now-Live`,
 * HANDOFF "Home"): what is happening for the member at page load. Home doesn't
 * poll (Q11), so this is the evening as it stood when the page loaded.
 *
 * - the draw: who you meet, and `See the draw`;
 * - your match this round: the scoreboard and headline at full time, with
 *   `See the report`, or `Watch your match` while it plays;
 * - out, or not in the final: `Follow the final` (HANDOFF);
 * - a bye, or between rounds: the evening's title and your night in a line.
 */
export function homeEvening(input: {
  userId: string;
  weekStart: string;
  rounds: number;
  lockAt: string;
  scheduleVersion: number;
  now: Date;
  draw: readonly DrawRow[];
  matches: readonly MatchRow[];
}): HomeEvening {
  const { userId, rounds, lockAt, scheduleVersion, weekStart } = input;
  const night = myNight({ userId, rounds, lockAt, scheduleVersion, matches: input.matches });
  const phase = eveningPhase({ rounds, lockAt, scheduleVersion, now: input.now, night });
  const evening = { label: "Follow the bracket", href: "/midweek" };
  const followFinal = { label: "Follow the final", href: "/midweek" };
  const report = (match: MatchRow) => `/midweek/${weekStart}/match/${match.match_id}`;
  const yours = (match: MatchRow) =>
    match.side_0_user_id === userId || match.side_1_user_id === userId;

  if (phase.kind === "draw") {
    const first = firstMatch({ userId, draw: input.draw, rounds, lockAt, scheduleVersion });
    const roundOne = formatClock(roundStartAt(new Date(lockAt), 1, scheduleVersion).toISOString());
    return {
      kicker: "Midweek Madness · The draw",
      title: phase.title,
      line: first?.text ?? `Round 1 kicks off at ${roundOne}.`,
      match: null,
      button: { label: "See the draw", href: "/midweek" },
    };
  }

  const kicker = `Midweek Madness · ${phase.kind === "final" ? "The final" : roundName(phase.round, rounds)}`;
  const playing = input.matches.find(
    (match) =>
      match.round === phase.round && !match.bye && (phase.kind === "final" || yours(match)),
  );
  const line = liveLine(night, rounds, lockAt, scheduleVersion);
  if (playing && atFullTime(playing)) {
    return {
      kicker,
      title: phase.title,
      line,
      match: playing,
      // Out is out: from the moment you lose, the card points at the final (HANDOFF).
      button:
        yours(playing) && phase.kind !== "out"
          ? { label: "See the report", href: report(playing) }
          : followFinal,
    };
  }
  if (playing) {
    const kickoff = formatClock(
      roundStartAt(new Date(lockAt), phase.round, scheduleVersion).toISOString(),
    );
    return {
      kicker,
      title: phase.title,
      line: `${yours(playing) ? "Your match" : "The final"} kicked off at ${kickoff}.`,
      match: null,
      button: yours(playing) ? { label: "Watch your match", href: report(playing) } : followFinal,
    };
  }
  return {
    kicker,
    title: phase.title,
    line,
    match: null,
    button: phase.kind === "out" || phase.kind === "final" ? followFinal : evening,
  };
}

import { predictionCoins } from "@/game/midweek/rewards";
import {
  capitalise,
  matchName,
  roundShort,
  type BracketPair,
  type BracketRound,
  type MyNight,
  winnerName,
} from "./evening";
import { formatClock } from "./entry";
import type { MatchRow } from "./rows";

/**
 * Calls (DR3 HANDOFF §2, ADR-118): a member who is out picks the winner of
 * each later match they are not in. This module turns the bracket the page
 * already has, the member's own picks and the club's splits into one card per
 * match, in the states the mockups name. Pure, so the evening page, the
 * bracket and the tests read the same thing.
 */

/** `kut.my_midweek_predictions`. */
export type MyPredictionRow = {
  tournament_id: string;
  week_start: string;
  round: number;
  pairing: number;
  predicted_user_id: string;
  predicted_name: string;
  saved_at: string;
  /** Null until the match has ended. */
  correct: boolean | null;
};

/** `kut.midweek_prediction_splits_public`: a match nobody called has no row. */
export type PredictionSplitRow = {
  match_id: string;
  tournament_id: string;
  round: number;
  pairing: number;
  side_0_picks: number;
  side_1_picks: number;
};

/** `kut.my_midweek_prediction_rewards`: one row per week paid; none when nothing came true. */
export type MyPredictionRewardRow = {
  tournament_id: string;
  week_start: string;
  picks: number;
  correct: number;
  amount: number;
  paid_at: string;
};

export type CallState = "notyet" | "open" | "closed" | "ended";

export type CallSide = { userId: string | null; name: string };

export type CallCard = {
  round: number;
  pairing: number;
  /** `Semi-final 1`, `The final`. */
  label: string;
  kickoffAt: string;
  /** Side 0 is the winner of feeder `2k`, side 1 of `2k + 1`. A side not settled names its feeder. */
  sides: [CallSide, CallSide];
  state: CallState;
  /** Closed and being played now. */
  live: boolean;
  pick: 0 | 1 | null;
  savedAt: string | null;
  winner: 0 | 1 | null;
  /** From kick-off: the club's picks per side, `[0, 0]` when nobody called it. */
  split: [number, number] | null;
};

const settled = (side: CallSide) => side.userId !== null;

/** A side not settled yet: `Winner of Sophie v Sanne` once its feeder is drawn, else the bracket's own words. */
function feederText(before: BracketRound | undefined, pairing: number, fallback: string): string {
  const feeder = before?.pairs[pairing];
  if (feeder && feeder.kind !== "bye" && feeder.sides.every((side) => !side.placeholder)) {
    return `Winner of ${feeder.sides[0].name} v ${feeder.sides[1].name}`;
  }
  return fallback;
}

function cardFor(
  pair: BracketPair,
  bracket: readonly BracketRound[],
  rounds: number,
  now: Date,
): Omit<CallCard, "pick" | "savedAt" | "split"> {
  const label = capitalise(matchName(pair.round, pair.pairing, rounds));
  const kickoffAt = bracket[pair.round - 1].kickoffAt;
  const base = { round: pair.round, pairing: pair.pairing, label, kickoffAt };
  if (pair.kind === "played") {
    return {
      ...base,
      sides: [
        { userId: pair.match.side_0_user_id, name: pair.match.side_0_name },
        { userId: pair.match.side_1_user_id, name: pair.match.side_1_name ?? "" },
      ],
      state: "ended",
      live: false,
      winner: pair.match.winner_side,
    };
  }
  if (pair.kind === "inplay") {
    return {
      ...base,
      sides: [
        { userId: pair.match.side_0_user_id, name: pair.match.side_0_name },
        { userId: pair.match.side_1_user_id, name: pair.match.side_1_name ?? "" },
      ],
      state: "closed",
      live: true,
      winner: null,
    };
  }
  if (pair.kind === "bye") throw new Error("A bye is never called.");
  const before = bracket[pair.round - 2];
  const sides = pair.sides.map((side, s) =>
    side.placeholder
      ? { userId: null, name: feederText(before, 2 * pair.pairing + s, side.name) }
      : { userId: side.userId, name: side.name },
  ) as [CallSide, CallSide];
  const kickedOff = Date.parse(kickoffAt) <= now.getTime();
  return {
    ...base,
    sides,
    state: kickedOff ? "closed" : sides.every(settled) ? "open" : "notyet",
    live: false,
    winner: null,
  };
}

const RANK: Record<CallState, number> = { open: 0, notyet: 0, closed: 1, ended: 1 };

/**
 * The member's call cards, or null when they have nothing to call: still in,
 * not entered, or out in the final. Every match of every round after the one
 * they went out in; listed by kick-off with the open and not-yet-open first,
 * then the closed ones newest first, so a live final leads its semi-finals.
 */
export function callCards(input: {
  bracket: readonly BracketRound[];
  night: Pick<MyNight, "rows">;
  predictions: readonly MyPredictionRow[];
  splits: readonly PredictionSplitRow[];
  now: Date;
}): CallCard[] | null {
  const out = input.night.rows.find((row) => row.kind === "out");
  if (!out) return null;
  const rounds = input.bracket.length;
  const cards: CallCard[] = [];
  for (const round of input.bracket.slice(out.round)) {
    for (const pair of round.pairs) {
      const card = cardFor(pair, input.bracket, rounds, input.now);
      const mine = input.predictions.find(
        (row) => row.round === pair.round && row.pairing === pair.pairing,
      );
      const pickSide = mine
        ? card.sides.findIndex((side) => side.userId === mine.predicted_user_id)
        : -1;
      const splitRow = input.splits.find(
        (row) => row.round === pair.round && row.pairing === pair.pairing,
      );
      const kickedOff = card.state === "closed" || card.state === "ended";
      cards.push({
        ...card,
        pick: pickSide === 0 || pickSide === 1 ? pickSide : null,
        savedAt: mine?.saved_at ?? null,
        split: kickedOff
          ? splitRow
            ? [splitRow.side_0_picks, splitRow.side_1_picks]
            : [0, 0]
          : null,
      });
    }
  }
  if (cards.length === 0) return null;
  return cards.sort((a, b) => {
    const rank = RANK[a.state] - RANK[b.state];
    if (rank !== 0) return rank;
    const order = RANK[a.state] === 0 ? a.round - b.round : b.round - a.round;
    return order || a.pairing - b.pairing;
  });
}

/** Correct picks so far: matches ended with the member's pick the winner. */
export const callsRight = (cards: readonly CallCard[]) =>
  cards.filter((card) => card.state === "ended" && card.pick !== null && card.pick === card.winner)
    .length;

/** The block's title and the line under it (HANDOFF "Copy", Calls). */
export function callsHeading(
  cards: readonly CallCard[],
  rounds: number,
  paid: boolean,
): { title: string; note: string } {
  const coins = predictionCoins(rounds);
  const open = cards.some((card) => card.state === "open" || card.state === "notyet");
  const title = open ? "Call the winners" : "Your calls";
  const right = callsRight(cards);
  if (paid) return { title, note: "Paid" };
  if (right > 0)
    return { title, note: `${right} right so far · +${right * coins} after the final` };
  if (cards.every((card) => card.state === "notyet")) return { title, note: "Nothing to call yet" };
  return { title, note: `+${coins} KUT Coins a correct pick · paid after the final` };
}

/** The weekly line, as in the result message: `You called 2 of 3 right: +4 KUT Coins.` */
export function weeklyCallsLine(correct: number, picks: number, coins: number): string {
  return correct > 0
    ? `You called ${correct} of ${picks} right: +${correct * coins} KUT Coins.`
    : `You called 0 of ${picks} right.`;
}

/** The bracket's jump link while a call is open: `Call the semis · 1 open`. */
export function callJumpLink(
  cards: readonly CallCard[],
  rounds: number,
): { round: number; label: string } | null {
  const open = cards.filter((card) => card.state === "open");
  if (open.length === 0) return null;
  const round = Math.min(...open.map((card) => card.round));
  const short = roundShort(round, rounds);
  const what = /^Round /.test(short) ? short.toLowerCase() : `the ${short.toLowerCase()}`;
  return {
    round,
    label: `Call ${what} · ${open.filter((card) => card.round === round).length} open`,
  };
}

/** The status line under a card's options, for a state the page rendered (not a tap in progress). */
export function settledStatus(card: CallCard, paid: boolean, coins: number): string {
  const kickoff = formatClock(card.kickoffAt);
  const name = (side: 0 | 1) => card.sides[side].name;
  switch (card.state) {
    case "notyet":
      return "Opens when both matches before it have ended.";
    case "open":
      return card.pick === null
        ? `Tap a name to call it. Closes at kick-off, ${kickoff}.`
        : `✓ Saved ${formatClock(card.savedAt ?? card.kickoffAt)}. Change it until kick-off, ${kickoff}; tap ${name(card.pick)} again to clear it.`;
    case "closed":
      return card.pick === null
        ? "Closed at kick-off. You didn’t call this one."
        : `Closed at kick-off. You picked ${name(card.pick)}.`;
    case "ended": {
      const winner = name(card.winner ?? 0);
      if (card.pick === null) return `${winner} won. You didn’t call this one.`;
      return card.pick === card.winner
        ? `✓ You called it ${winner} won. +${coins} KUT Coins${paid ? "" : " after the final"}.`
        : `Not this time ${winner} won.`;
    }
  }
}

/**
 * A refused save, by the guard's message (HANDOFF "Copy", Refusals): the last
 * saved pick stays, and the line says why. `kept` is that pick's name.
 */
export function callError(message: string | null, kickoffAt: string, kept: string | null): string {
  const kickoff = formatClock(kickoffAt);
  if (message?.includes("predictions close at kick-off")) {
    return kept
      ? `Couldn’t change it: picks closed at kick-off, ${kickoff}. Your pick stays ${kept}.`
      : `Couldn’t save: picks closed at kick-off, ${kickoff}.`;
  }
  if (message?.includes("opens for predictions once both matches before it have ended")) {
    return "Not open yet: it opens when both matches before it have ended.";
  }
  if (message?.includes("predictions open once you are out")) return "Calls open once you’re out.";
  return "Couldn’t save. Check your connection and tap again.";
}

/** The bracket's chip per row, keyed `round/pairing`: a pick, or an open match not called yet. */
export function rowCalls(
  cards: readonly CallCard[],
): Map<string, { kind: "picked"; name: string } | { kind: "open" }> {
  const map = new Map<string, { kind: "picked"; name: string } | { kind: "open" }>();
  for (const card of cards) {
    const key = `${card.round}/${card.pairing}`;
    if (card.pick !== null) map.set(key, { kind: "picked", name: card.sides[card.pick].name });
    else if (card.state === "open") map.set(key, { kind: "open" });
  }
  return map;
}

export type CallRecord = {
  label: string;
  picked: string;
  winner: string | null;
  correct: boolean | null;
};

/** The complete bracket's `Your calls`: every pick, in match order, with how it ended. */
export function callRecords(
  predictions: readonly MyPredictionRow[],
  matches: readonly MatchRow[],
  rounds: number,
): CallRecord[] {
  return [...predictions]
    .sort((a, b) => a.round - b.round || a.pairing - b.pairing)
    .map((row) => {
      const match = matches.find((m) => m.round === row.round && m.pairing === row.pairing);
      return {
        label: capitalise(matchName(row.round, row.pairing, rounds)),
        picked: row.predicted_name,
        winner: match && match.winner_side !== null ? winnerName(match) : null,
        correct: row.correct,
      };
    });
}

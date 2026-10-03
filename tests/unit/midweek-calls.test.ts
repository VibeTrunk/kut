import { describe, expect, it } from "vitest";
import {
  callCards,
  callError,
  callJumpLink,
  callsHeading,
  callsRight,
  settledStatus,
  weeklyCallsLine,
  type CallCard,
  type MyPredictionRow,
  type PredictionSplitRow,
} from "@/lib/midweek/calls";
import { assembleBracket, myNight } from "@/lib/midweek/evening";
import type { DrawRow, MatchRow } from "@/lib/midweek/rows";

/**
 * Calls (DR3 HANDOFF §2, ADR-118): the cards a member who is out sees, from
 * the bracket the page already has, their picks and the club's splits.
 */

// Eight entrants, three rounds, on the 19:55 clock: round 1 at 20:00, the
// semi-finals at 20:15, the final at 20:30 (18:00Z, 18:15Z, 18:30Z).
const LOCK = "2026-10-07T17:55:00.000Z";
const NAMES: Record<string, string> = {
  a: "Ann",
  b: "Bas",
  c: "Cas",
  d: "Dirk",
  e: "Eve",
  f: "Fay",
  g: "Gus",
  h: "Hil",
};
const ID = (k: string) => `00000000-0000-4000-8000-00000000000${"abcdefgh".indexOf(k) + 1}`;

const R1: [string, string][] = [
  ["a", "b"],
  ["c", "d"],
  ["e", "f"],
  ["g", "h"],
];

const draw: DrawRow[] = R1.map(([x, y], pairing) => ({
  match_id: `r1-${pairing}`,
  tournament_id: "t",
  week_start: "2026-10-05",
  pairing,
  bye: false,
  side_0_user_id: ID(x),
  side_0_name: NAMES[x],
  side_1_user_id: ID(y),
  side_1_name: NAMES[y],
  kickoff_at: "2026-10-07T18:00:00.000Z",
}));

/** A match as the views show it: `winner` null while it is in play. */
function match(
  round: number,
  pairing: number,
  x: string,
  y: string,
  winner: 0 | 1 | null,
): MatchRow {
  const start = ["", "18:00", "18:15", "18:30"][round];
  return {
    match_id: `r${round}-${pairing}`,
    tournament_id: "t",
    week_start: "2026-10-05",
    round,
    pairing,
    bye: false,
    side_0_user_id: ID(x),
    side_0_name: NAMES[x],
    side_1_user_id: ID(y),
    side_1_name: NAMES[y],
    side_0_goals: winner === null ? null : winner === 0 ? 1 : 0,
    side_1_goals: winner === null ? null : winner === 1 ? 1 : 0,
    side_0_penalties: null,
    side_1_penalties: null,
    winner_side: winner,
    winner_user_id: winner === null ? null : ID(winner === 0 ? x : y),
    win_chance_ppm: 500_000,
    side_0_day_rolls_ppm: [],
    side_1_day_rolls_ppm: [],
    reveal_at: `2026-10-07T${start}:00.000Z`,
    in_play: winner === null,
  };
}

function cardsAt(input: {
  now: string;
  matches: MatchRow[];
  predictions?: MyPredictionRow[];
  splits?: PredictionSplitRow[];
  you?: string;
}) {
  const now = new Date(input.now);
  const bracket = assembleBracket({
    rounds: 3,
    lockAt: LOCK,
    scheduleVersion: 2,
    draw,
    matches: input.matches,
    autoUserIds: new Set(),
  });
  const night = myNight({
    userId: ID(input.you ?? "b"),
    rounds: 3,
    lockAt: LOCK,
    scheduleVersion: 2,
    matches: input.matches,
  });
  return callCards({
    bracket,
    night,
    predictions: input.predictions ?? [],
    splits: input.splits ?? [],
    now,
  });
}

const pickRow = (round: number, pairing: number, who: string): MyPredictionRow => ({
  tournament_id: "t",
  week_start: "2026-10-05",
  round,
  pairing,
  predicted_user_id: ID(who),
  predicted_name: NAMES[who],
  saved_at: "2026-10-07T18:11:00.000Z",
  correct: null,
});

const splitRow = (round: number, pairing: number, a: number, b: number): PredictionSplitRow => ({
  match_id: `r${round}-${pairing}`,
  tournament_id: "t",
  round,
  pairing,
  side_0_picks: a,
  side_1_picks: b,
});

// Bas lost round 1 to Ann at 20:04; at 20:12 Eve v Fay is still in play.
const ROUND_ONE_LATE = [
  match(1, 0, "a", "b", 0),
  match(1, 1, "c", "d", 0),
  match(1, 2, "e", "f", null),
  match(1, 3, "g", "h", 0),
];

describe("call cards", () => {
  it("are only for a member who is out", () => {
    expect(cardsAt({ now: "2026-10-07T18:12:00Z", matches: ROUND_ONE_LATE, you: "a" })).toBeNull();
    expect(cardsAt({ now: "2026-10-07T18:12:00Z", matches: ROUND_ONE_LATE, you: "e" })).toBeNull();
  });

  it("open a match once both feeders have ended, and name an unsettled side by its feeder", () => {
    const cards = cardsAt({ now: "2026-10-07T18:12:00Z", matches: ROUND_ONE_LATE })!;
    expect(cards.map((card) => [card.label, card.state])).toEqual([
      ["Semi-final 1", "open"],
      ["Semi-final 2", "notyet"],
      ["The final", "notyet"],
    ]);
    expect(cards[0].sides).toEqual([
      { userId: ID("a"), name: "Ann" },
      { userId: ID("c"), name: "Cas" },
    ]);
    expect(cards[1].sides).toEqual([
      { userId: null, name: "Winner of Eve v Fay" },
      { userId: ID("g"), name: "Gus" },
    ]);
    expect(cards[2].sides.map((side) => side.name)).toEqual([
      "Winner of Ann v Cas",
      "Winner, Semis 2",
    ]);
    expect(cards.every((card) => card.split === null && card.pick === null)).toBe(true);
    expect(callsHeading(cards, 3, false)).toEqual({
      title: "Call the winners",
      note: "+10 KUT Coins a correct pick · paid after the final",
    });
    expect(settledStatus(cards[0], false, 10)).toBe(
      "Tap a name to call it. Closes at kick-off, 20:15.",
    );
    expect(settledStatus(cards[1], false, 10)).toBe(
      "Opens when both matches before it have ended.",
    );
  });

  it("say there is nothing to call while every match still waits on a feeder", () => {
    const cards = cardsAt({
      now: "2026-10-07T18:04:00Z",
      matches: [
        match(1, 0, "a", "b", 0),
        match(1, 1, "c", "d", null),
        match(1, 2, "e", "f", null),
        match(1, 3, "g", "h", null),
      ],
    })!;
    expect(cards.every((card) => card.state === "notyet")).toBe(true);
    expect(callsHeading(cards, 3, false).note).toBe("Nothing to call yet");
  });

  it("carry the member's pick on the right side, with its saved time", () => {
    const cards = cardsAt({
      now: "2026-10-07T18:12:00Z",
      matches: ROUND_ONE_LATE,
      predictions: [pickRow(2, 0, "c")],
    })!;
    expect(cards[0].pick).toBe(1);
    expect(settledStatus(cards[0], false, 10)).toBe(
      "✓ Saved 20:11. Change it until kick-off, 20:15; tap Cas again to clear it.",
    );
  });

  it("close at kick-off with the club's split, and end with the winner; newest closed first", () => {
    const cards = cardsAt({
      now: "2026-10-07T18:20:00Z",
      matches: [
        match(1, 0, "a", "b", 0),
        match(1, 1, "c", "d", 0),
        match(1, 2, "e", "f", 0),
        match(1, 3, "g", "h", 0),
        match(2, 0, "a", "c", null),
        match(2, 1, "e", "g", 1),
      ],
      predictions: [pickRow(2, 0, "a"), pickRow(2, 1, "e")],
      splits: [splitRow(2, 0, 3, 1)],
    })!;
    expect(cards.map((card) => [card.label, card.state, card.live])).toEqual([
      ["The final", "notyet", false],
      ["Semi-final 1", "closed", true],
      ["Semi-final 2", "ended", false],
    ]);
    expect(cards[1].split).toEqual([3, 1]);
    // Nobody called semi-final 2: no row, read as 0–0.
    expect(cards[2].split).toEqual([0, 0]);
    expect(cards[2].winner).toBe(1);
    expect(callsRight(cards)).toBe(0);
    expect(settledStatus(cards[1], false, 10)).toBe("Closed at kick-off. You picked Ann.");
    expect(settledStatus(cards[2], false, 10)).toBe("Not this time Gus won.");
  });

  it("read as paid once the week is complete", () => {
    const cards = cardsAt({
      now: "2026-10-07T18:40:00Z",
      matches: [
        match(1, 0, "a", "b", 0),
        match(1, 1, "c", "d", 0),
        match(1, 2, "e", "f", 0),
        match(1, 3, "g", "h", 0),
        match(2, 0, "a", "c", 0),
        match(2, 1, "e", "g", 1),
        match(3, 0, "a", "g", 1),
      ],
      predictions: [pickRow(2, 0, "a"), pickRow(3, 0, "a")],
    })!;
    expect(callsRight(cards)).toBe(1);
    expect(callsHeading(cards, 3, false)).toEqual({
      title: "Your calls",
      note: "1 right so far · +10 after the final",
    });
    expect(callsHeading(cards, 3, true)).toEqual({ title: "Your calls", note: "Paid" });
    const semi = cards.find((card) => card.label === "Semi-final 1")!;
    expect(settledStatus(semi, false, 10)).toBe(
      "✓ You called it Ann won. +10 KUT Coins after the final.",
    );
    expect(settledStatus(semi, true, 10)).toBe("✓ You called it Ann won. +10 KUT Coins.");
  });
});

describe("call copy", () => {
  it("words the weekly line as the result message does", () => {
    expect(weeklyCallsLine(2, 3, 2)).toBe("You called 2 of 3 right: +4 KUT Coins.");
    expect(weeklyCallsLine(0, 2, 2)).toBe("You called 0 of 2 right.");
  });

  it("words each refusal by the guard's message", () => {
    const kickoff = "2026-10-07T18:45:00.000Z";
    expect(callError("predictions close at kick-off", kickoff, "Sophie")).toBe(
      "Couldn’t change it: picks closed at kick-off, 20:45. Your pick stays Sophie.",
    );
    expect(callError("predictions close at kick-off", kickoff, null)).toBe(
      "Couldn’t save: picks closed at kick-off, 20:45.",
    );
    expect(
      callError(
        "this match opens for predictions once both matches before it have ended",
        kickoff,
        null,
      ),
    ).toBe("Not open yet: it opens when both matches before it have ended.");
    expect(callError("predictions open once you are out", kickoff, null)).toBe(
      "Calls open once you’re out.",
    );
    expect(callError(null, kickoff, null)).toBe(
      "Couldn’t save. Check your connection and tap again.",
    );
  });

  it("leads the bracket's jump links with the earliest round still open", () => {
    const card = (round: number, state: CallCard["state"]): CallCard => ({
      round,
      pairing: 0,
      label: "x",
      kickoffAt: LOCK,
      sides: [
        { userId: null, name: "" },
        { userId: null, name: "" },
      ],
      state,
      live: false,
      pick: null,
      savedAt: null,
      winner: null,
      split: null,
    });
    expect(callJumpLink([card(4, "open"), card(4, "open"), card(5, "notyet")], 5)).toEqual({
      round: 4,
      label: "Call the semis · 2 open",
    });
    expect(callJumpLink([card(2, "open")], 5)).toEqual({
      round: 2,
      label: "Call round 2 · 1 open",
    });
    expect(callJumpLink([card(5, "open")], 5)?.label).toBe("Call the final · 1 open");
    expect(callJumpLink([card(5, "closed")], 5)).toBeNull();
  });
});

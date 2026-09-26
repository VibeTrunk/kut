import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { roundPayouts } from "@/game/midweek/rewards";
import { revealAt } from "@/game/midweek/schedule";
import type { SimulatedTournament, TournamentResult } from "@/game/midweek/tournament";
import {
  assembleBracket,
  championLeads,
  championLeadsUntil,
  factorText,
  fieldCounts,
  finalLine,
  finishStat,
  handicapText,
  isWeekStart,
  liveLine,
  matchName,
  matchSentence,
  myNight,
  nightTotals,
  revealStops,
  roundName,
  roundShort,
  wonRounds,
} from "@/lib/midweek/evening";
import type { MatchRow } from "@/lib/midweek/rows";

const golden = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests/fixtures/midweek-golden.json"), "utf8"),
) as { tournaments: { name: string; result: TournamentResult }[] };

const LOCK = "2026-10-07T18:00:00.000Z";
const nameOf = (userId: string) => `Manager ${userId.slice(0, 8)}`;

/** A golden tournament as `kut.midweek_matches_public` returns it once every round is out. */
function storedRows(result: SimulatedTournament): MatchRow[] {
  const reveal = (round: number) => revealAt(new Date(LOCK), round).toISOString();
  const base = {
    tournament_id: "t",
    week_start: "2026-10-05",
    side_0_penalties: null,
    side_1_penalties: null,
  };
  const byes: MatchRow[] = result.byes.map((bye) => ({
    ...base,
    match_id: `bye-${bye.pairing}`,
    round: 1,
    pairing: bye.pairing,
    bye: true,
    side_0_user_id: bye.userId,
    side_0_name: nameOf(bye.userId),
    side_1_user_id: null,
    side_1_name: null,
    side_0_goals: null,
    side_1_goals: null,
    winner_side: 0,
    winner_user_id: bye.userId,
    win_chance_ppm: null,
    side_0_day_rolls_ppm: null,
    side_1_day_rolls_ppm: null,
    reveal_at: reveal(1),
  }));
  const played: MatchRow[] = result.matches.map((match) => ({
    ...base,
    match_id: `m-${match.round}-${match.pairing}`,
    round: match.round,
    pairing: match.pairing,
    bye: false,
    side_0_user_id: match.userIds[0],
    side_0_name: nameOf(match.userIds[0]),
    side_1_user_id: match.userIds[1],
    side_1_name: nameOf(match.userIds[1]),
    side_0_goals: match.outcome.goals[0],
    side_1_goals: match.outcome.goals[1],
    side_0_penalties: match.outcome.penalties?.[0] ?? null,
    side_1_penalties: match.outcome.penalties?.[1] ?? null,
    winner_side: match.outcome.winnerSide,
    winner_user_id: match.userIds[match.outcome.winnerSide],
    win_chance_ppm: match.outcome.winChancePpm,
    side_0_day_rolls_ppm: match.outcome.dayRollsPpm[0],
    side_1_day_rolls_ppm: match.outcome.dayRollsPpm[1],
    reveal_at: reveal(match.round),
  }));
  return [...byes, ...played];
}

// Nine entrants: 16 slots, four rounds, seven byes and a shoot-out.
const nine = golden.tournaments.find((t) => t.name === "9 entrants, mixed squads")!
  .result as SimulatedTournament;
const rows = storedRows(nine);
const upTo = (round: number) => rows.filter((row) => row.round <= round);

describe("midweek round and match names", () => {
  it("names rounds from the end, so they hold for every bracket size", () => {
    expect([1, 2, 3, 4, 5].map((r) => roundName(r, 5))).toEqual([
      "Round 1",
      "Round 2",
      "Quarter-finals",
      "Semi-finals",
      "Final",
    ]);
    expect([1, 2].map((r) => roundShort(r, 2))).toEqual(["Semis", "Final"]);
    expect(matchName(3, 1, 5)).toBe("quarter-final 2");
    expect(matchName(1, 2, 5)).toBe("round 1, match 3");
  });
});

describe("owner decision D4: the champion leads until Thursday 23:59 Amsterdam", () => {
  const cases: [string, string, string][] = [
    // [lock, first moment the strip takes over, what it is]
    ["2026-10-07T18:00:00.000Z", "2026-10-08T22:00:00.000Z", "summer time (CEST)"],
    ["2026-11-04T19:00:00.000Z", "2026-11-05T23:00:00.000Z", "winter time (CET)"],
    // The week the clocks go back (Sunday 25 October 2026): the Friday is still CEST.
    ["2026-10-21T18:00:00.000Z", "2026-10-22T22:00:00.000Z", "last summer Wednesday"],
    ["2026-10-28T19:00:00.000Z", "2026-10-29T23:00:00.000Z", "first winter Wednesday"],
    // The week the clocks go forward (Sunday 28 March 2027): the Friday is still CET.
    ["2027-03-24T19:00:00.000Z", "2027-03-25T23:00:00.000Z", "last winter Wednesday"],
    ["2027-03-31T18:00:00.000Z", "2027-04-01T22:00:00.000Z", "first summer Wednesday"],
  ];

  it.each(cases)("a lock at %s leads until %s (%s)", (lock, until) => {
    expect(championLeadsUntil(lock).toISOString()).toBe(until);
    const complete = { status: "complete", lock_at: lock };
    expect(championLeads(complete, new Date(Date.parse(until) - 1))).toBe(true);
    expect(championLeads(complete, new Date(until))).toBe(false);
  });

  it("leads only once the week is complete", () => {
    const now = new Date("2026-10-07T21:00:00.000Z");
    expect(championLeads({ status: "simulated", lock_at: LOCK }, now)).toBe(false);
    expect(championLeads({ status: "void", lock_at: LOCK }, now)).toBe(false);
    expect(championLeads({ status: "complete", lock_at: LOCK }, now)).toBe(true);
  });
});

describe("the reveal clock", () => {
  const stops = (now: string) =>
    revealStops({ lockAt: LOCK, rounds: 5, now: new Date(now), wonRounds: new Set([1, 2]) });

  it("marks rounds out, the next one, and the rest hidden", () => {
    const evening = stops("2026-10-07T19:05:00.000Z");
    expect(evening.map((s) => s.state)).toEqual([
      "lock",
      "done",
      "done",
      "next",
      "hidden",
      "hidden",
    ]);
    expect(evening.map((s) => s.time)).toEqual([
      "20:00",
      "20:30",
      "21:00",
      "21:30",
      "22:00",
      "22:30",
    ]);
    expect(evening.map((s) => s.name)).toEqual([
      "Lock",
      "Round 1",
      "Round 2",
      "Quarters",
      "Semis",
      "Final",
    ]);
    expect(evening.map((s) => s.you)).toEqual([false, true, true, false, false, false]);
  });

  it("stops at the lock before round 1 and at the final after it", () => {
    expect(stops("2026-10-07T18:12:00.000Z").map((s) => s.state)).toEqual([
      "lock",
      "next",
      "hidden",
      "hidden",
      "hidden",
      "hidden",
    ]);
    expect(stops("2026-10-07T20:41:00.000Z").every((s) => s.state !== "next")).toBe(true);
  });
});

describe("the bracket", () => {
  it("lays out every pairing, byes as their own rows, each entrant once in round 1", () => {
    const bracket = assembleBracket({
      rounds: 4,
      lockAt: LOCK,
      matches: rows,
      autoUserIds: new Set(),
    });
    expect(bracket.map((r) => r.pairs.length)).toEqual([8, 4, 2, 1]);
    expect(bracket.every((r) => r.revealed)).toBe(true);
    const round1 = bracket[0].pairs;
    expect(round1.filter((p) => p.kind === "bye")).toHaveLength(7);
    const entrants = round1.flatMap((p) => p.sides.map((s) => s.userId));
    expect(new Set(entrants).size).toBe(9);
    expect(entrants).toHaveLength(9);
    expect(bracket.map((r) => r.revealAt)).toEqual([
      "2026-10-07T18:30:00.000Z",
      "2026-10-07T19:00:00.000Z",
      "2026-10-07T19:30:00.000Z",
      "2026-10-07T20:00:00.000Z",
    ]);
  });

  it("names who meet once the round before is out, and where they come from otherwise", () => {
    const bracket = assembleBracket({
      rounds: 4,
      lockAt: LOCK,
      matches: upTo(1),
      autoUserIds: new Set([nine.entries[0].userId]),
    });
    const round2 = bracket[1];
    expect(round2.revealed).toBe(false);
    for (const pair of round2.pairs) {
      expect(pair.kind).toBe("hidden");
      if (pair.kind !== "hidden") continue;
      expect(pair.known).toBe(true);
      const feeders = [2 * pair.pairing, 2 * pair.pairing + 1].map(
        (p) => rows.find((row) => row.round === 1 && row.pairing === p)!.winner_user_id,
      );
      expect(pair.sides.map((s) => s.userId)).toEqual(feeders);
    }
    const semis = bracket[2].pairs[1];
    expect(semis.kind === "hidden" && semis.known).toBe(false);
    expect(semis.sides.map((s) => s.name)).toEqual(["Winner, QF 3", "Winner, QF 4"]);
    const final = bracket[3].pairs[0];
    expect(final.sides.map((s) => s.name)).toEqual(["Winner, SF 1", "Winner, SF 2"]);
    const auto = bracket[0].pairs.flatMap((p) => p.sides).filter((s) => s.auto);
    expect(auto.map((s) => s.userId)).toEqual([nine.entries[0].userId]);
  });

  it("describes a match in one sentence, penalties included", () => {
    const shootout = rows.find((row) => row.side_0_penalties !== null)!;
    const sentence = matchSentence(shootout);
    expect(sentence).toMatch(
      /^Manager \w+ (\d+), Manager \w+ \1, \d+–\d+ on penalties\. Manager \w+ won\.$/,
    );
    expect(matchSentence(rows.find((row) => row.bye)!)).toMatch(
      /has a bye\. A bye counts as a win\.$/,
    );
  });
});

describe("your night", () => {
  const pays = roundPayouts(4);

  it("follows the champion to 250 coins and a Champion finish", () => {
    const night = myNight({ userId: nine.championUserId, rounds: 4, lockAt: LOCK, matches: rows });
    expect(night.champion).toBe(true);
    expect(night.coins).toBe(250);
    expect(night.rows.at(-1)!.kind).toBe("won");
    expect(finishStat(night, 4)).toEqual({ value: "Champion", note: "won the final" });
    expect(wonRounds(night)).toEqual(new Set([1, 2, 3, 4]));
  });

  it("stops at the round a member went out in, with no coins for it", () => {
    const final = rows.find((row) => row.round === 4)!;
    const loser = final.winner_side === 0 ? final.side_1_user_id! : final.side_0_user_id;
    const night = myNight({ userId: loser, rounds: 4, lockAt: LOCK, matches: rows });
    expect(night.alive).toBe(false);
    expect(night.rows.at(-1)).toMatchObject({ kind: "out", round: 4, coins: 0 });
    expect(night.coins).toBe(pays[0] + pays[1] + pays[2]);
    expect(finishStat(night, 4).value).toBe("Final");
  });

  it("adds a Next row with the neighbouring winner while the next round is hidden", () => {
    const bye = rows.find((row) => row.bye)!;
    const night = myNight({
      userId: bye.side_0_user_id,
      rounds: 4,
      lockAt: LOCK,
      matches: upTo(1),
    });
    expect(night.rows[0]).toMatchObject({ kind: "bye", round: 1, coins: pays[0] });
    const sibling = rows.find((row) => row.round === 1 && row.pairing === (bye.pairing ^ 1))!;
    expect(night.rows[1]).toMatchObject({
      kind: "next",
      round: 2,
      coins: pays[1],
      opponent: sibling.winner_side === 0 ? sibling.side_0_name : sibling.side_1_name,
      revealAt: "2026-10-07T19:00:00.000Z",
    });
    expect(night.alive).toBe(true);
    expect(night.coins).toBe(pays[0]);
    expect(liveLine(night, 4, LOCK)).toMatch(
      /^You had a bye\. Quarter-final against Manager \w+ at 21:00\.$/,
    );
  });

  it("is empty for a member who isn't in the bracket", () => {
    const night = myNight({ userId: "someone-else", rounds: 4, lockAt: LOCK, matches: rows });
    expect(night).toMatchObject({ entered: false, coins: 0, rows: [] });
    expect(finishStat(night, 4)).toEqual({ value: "—", note: "sat it out" });
    expect(liveLine(night, 4, LOCK)).toBe("The final is at 22:00.");
  });

  it("scores from your side first, and says how you went out", () => {
    const shootout = rows.find((row) => row.side_0_penalties !== null && row.round < 4)!;
    const loser = shootout.winner_side === 0 ? shootout.side_1_user_id! : shootout.side_0_user_id;
    const night = myNight({ userId: loser, rounds: 4, lockAt: LOCK, matches: rows });
    const out = night.rows.at(-1)!;
    expect(out.kind).toBe("out");
    if (out.kind !== "out") return;
    const mine = shootout.side_0_user_id === loser ? 0 : 1;
    const [my, their] =
      mine === 0
        ? [shootout.side_0_penalties, shootout.side_1_penalties]
        : [shootout.side_1_penalties, shootout.side_0_penalties];
    expect(out.score).toMatch(new RegExp(`^(\\d+)–\\1, ${my}–${their} on penalties$`));
    expect(liveLine(night, 4, LOCK)).toMatch(/^You went out to Manager \w+ on penalties\./);
  });
});

describe("the club's night", () => {
  it("counts goals in played matches and the full bracket's coins", () => {
    const totals = nightTotals(rows, 4);
    expect(totals.matches).toBe(nine.matches.length);
    expect(totals.coins).toBe(nine.payouts.reduce((sum, p) => sum + p.amount, 0));
    expect(totals.coins).toBe(650);
    expect(totals.goals).toBe(
      nine.matches.reduce((sum, m) => sum + m.outcome.goals[0] + m.outcome.goals[1], 0),
    );
  });

  it("counts entrants and auto squads from card rows", () => {
    const entries = nine.entries.flatMap((entry) =>
      entry.cards.map(() => ({ user_id: entry.userId, auto: entry.auto })),
    );
    expect(fieldCounts(entries)).toEqual({
      entrants: 9,
      auto: nine.entries.filter((entry) => entry.auto).length,
    });
  });

  it("puts the champion's numbers first in the final's line", () => {
    const final: MatchRow = { ...rows.find((row) => row.round === 4)! };
    const plain = {
      ...final,
      side_0_goals: 1,
      side_1_goals: 3,
      side_0_penalties: null,
      side_1_penalties: null,
      winner_side: 1 as const,
    };
    expect(finalLine(plain)).toBe(`Beat ${final.side_0_name} in the final, 3–1.`);
    const pens = {
      ...plain,
      side_0_goals: 2,
      side_1_goals: 2,
      side_0_penalties: 7,
      side_1_penalties: 6,
      winner_side: 0 as const,
    };
    expect(finalLine(pens)).toBe(
      `Beat ${final.side_1_name} on penalties in the final, 2–2 and 7–6 from the spot.`,
    );
  });
});

describe("the why panel's numbers and the route segment", () => {
  it("prints a handicap at three decimals and factors with their direction", () => {
    expect(handicapText(575_000)).toBe("0.575");
    expect(handicapText(474_375)).toBe("0.474");
    expect(factorText(1_000_000)).toEqual({ text: "1.00", trend: "flat" });
    expect(factorText(1_004_000)).toEqual({ text: "1.00", trend: "flat" });
    expect(factorText(1_151_000)).toEqual({ text: "1.15", trend: "up" });
    expect(factorText(950_000)).toEqual({ text: "0.95", trend: "down" });
  });

  it("accepts only an ISO Monday as a week", () => {
    expect(isWeekStart("2026-10-05")).toBe(true);
    expect(isWeekStart("2026-10-06")).toBe(false);
    expect(isWeekStart("2026-02-30")).toBe(false);
    expect(isWeekStart("2026-10-5")).toBe(false);
    expect(isWeekStart("../../admin")).toBe(false);
  });
});

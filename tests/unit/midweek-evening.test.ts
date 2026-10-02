import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { roundPayouts } from "@/game/midweek/rewards";
import { roundStartAt } from "@/game/midweek/schedule";
import type { SimulatedTournament, TournamentResult } from "@/game/midweek/tournament";
import { formatDayDate, type MidweekTournament } from "@/lib/midweek/entry";
import {
  assembleBracket,
  championLeads,
  championLeadsUntil,
  eveningClockLabel,
  eveningPhase,
  eveningStops,
  factorText,
  fieldCounts,
  finalLine,
  finishStat,
  firstMatch,
  fiveOf,
  handicapText,
  homeEvening,
  isWeekStart,
  liveLine,
  matchName,
  matchSentence,
  myNight,
  nightTotals,
  pairSentence,
  pastWeeks,
  roundName,
  roundsYouAreIn,
  roundShort,
  treeGroupRows,
  wonRounds,
  yourNextRound,
} from "@/lib/midweek/evening";
import type { DrawRow, EntryCardRow, MatchRow } from "@/lib/midweek/rows";

const golden = JSON.parse(
  readFileSync(path.join(process.cwd(), "tests/fixtures/midweek-golden.json"), "utf8"),
) as { tournaments: { name: string; result: TournamentResult }[] };

// A version-1 week (lock 20:00, a round every 30 minutes), as every week before ADR-104.
const LOCK = "2026-10-07T18:00:00.000Z";
const V1 = 1;
const nameOf = (userId: string) => `Manager ${userId.slice(0, 8)}`;

/** A golden tournament as `kut.midweek_matches_public` returns it once every round is out. */
function storedRows(result: SimulatedTournament): MatchRow[] {
  const reveal = (round: number) => roundStartAt(new Date(LOCK), round, V1).toISOString();
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

describe("the lg bracket tree shares one row grid (KB-031)", () => {
  it("centres every pairing on the two that feed it", () => {
    for (const rounds of [2, 3, 4, 5, 6]) {
      for (let round = 2; round <= rounds; round += 1) {
        const pairs = 2 ** (rounds - round);
        for (let pairing = 0; pairing < pairs; pairing += 1) {
          // A pairing's own rows, as the half of its group it sits in.
          const own = (r: number, p: number) => {
            const { rowStart, rowSpan } = treeGroupRows(r, Math.floor(p / 2), r === rounds ? 1 : 2);
            const half = r === rounds ? rowSpan : rowSpan / 2;
            const start = rowStart + (p % 2) * half;
            return [start, start + half];
          };
          const [start, end] = own(round, pairing);
          const [feedStart] = own(round - 1, 2 * pairing);
          const [, feedEnd] = own(round - 1, 2 * pairing + 1);
          expect([start, end]).toEqual([feedStart, feedEnd]);
        }
      }
    }
  });

  it("gives round 1 one row per pairing below the header, whatever it holds", () => {
    expect(treeGroupRows(1, 0, 2)).toEqual({ rowStart: 2, rowSpan: 2 });
    expect(treeGroupRows(1, 7, 2)).toEqual({ rowStart: 16, rowSpan: 2 });
    expect(treeGroupRows(5, 0, 1)).toEqual({ rowStart: 2, rowSpan: 16 });
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

describe("the clock keeps each week's version (ADR-104)", () => {
  const times = (lockAt: string, scheduleVersion: number) =>
    eveningStops({
      lockAt,
      scheduleVersion,
      rounds: 5,
      now: new Date(lockAt),
      matches: [],
      youThrough: null,
    }).map((stop) => `${stop.name} ${stop.time}`);

  it("runs a version-1 evening: lock 20:00, a round every 30 minutes", () => {
    expect(times(LOCK, V1)).toEqual([
      "Lock 20:00",
      "Round 1 20:30",
      "Round 2 21:00",
      "Quarters 21:30",
      "Semis 22:00",
      "Final 22:30",
    ]);
  });

  it("runs a version-2 evening: lock 19:55, round 1 at 20:00, a round every 15 minutes", () => {
    expect(times("2026-10-14T17:55:00.000Z", 2)).toEqual([
      "Lock 19:55",
      "Round 1 20:00",
      "Round 2 20:15",
      "Quarters 20:30",
      "Semis 20:45",
      "Final 21:00",
    ]);
  });
});

/** Round 1 as `kut.midweek_draw_public` returns it from the lock: no result. */
const draw: DrawRow[] = rows
  .filter((row) => row.round === 1)
  .sort((a, b) => a.pairing - b.pairing)
  .map((row) => ({
    match_id: row.match_id,
    tournament_id: row.tournament_id,
    week_start: row.week_start,
    pairing: row.pairing,
    bye: row.bye,
    side_0_user_id: row.side_0_user_id,
    side_0_name: row.side_0_name,
    side_1_user_id: row.side_1_user_id,
    side_1_name: row.side_1_name,
    kickoff_at: row.reveal_at,
  }));
const roundOneMatch = draw.find((row) => !row.bye)!;

describe("the bracket", () => {
  const bracketOf = (matches: readonly MatchRow[], withDraw = true) =>
    assembleBracket({
      rounds: 4,
      lockAt: LOCK,
      scheduleVersion: V1,
      draw: withDraw ? draw : [],
      matches,
      autoUserIds: new Set([nine.entries[0].userId]),
    });

  it("lays out every pairing, byes as their own rows, each entrant once in round 1", () => {
    const bracket = bracketOf(rows);
    expect(bracket.map((r) => r.pairs.length)).toEqual([8, 4, 2, 1]);
    expect(bracket.every((r) => r.played)).toBe(true);
    const round1 = bracket[0].pairs;
    expect(round1.filter((p) => p.kind === "bye")).toHaveLength(7);
    expect(round1.filter((p) => p.kind === "played")).toHaveLength(1);
    const entrants = round1.flatMap((p) => p.sides.map((s) => s.userId));
    expect(new Set(entrants).size).toBe(9);
    expect(entrants).toHaveLength(9);
    expect(bracket.map((r) => r.kickoffAt)).toEqual([
      "2026-10-07T18:30:00.000Z",
      "2026-10-07T19:00:00.000Z",
      "2026-10-07T19:30:00.000Z",
      "2026-10-07T20:00:00.000Z",
    ]);
  });

  it("from the lock: round 1 as drawn, then 'Winner of …' in round 2 and 'Winner, Quarters 1' beyond", () => {
    const bracket = bracketOf([]);
    expect(bracket.some((r) => r.played)).toBe(false);
    const round1 = bracket[0].pairs;
    expect(round1.filter((p) => p.kind === "bye")).toHaveLength(7);
    const upcoming = round1.find((p) => p.kind === "upcoming")!;
    expect(upcoming.sides.map((s) => s.userId)).toEqual([
      roundOneMatch.side_0_user_id,
      roundOneMatch.side_1_user_id,
    ]);
    expect(upcoming.kind === "upcoming" && upcoming.kickoffAt).toBe("2026-10-07T18:30:00.000Z");

    // Round 2 (the quarter-finals of four rounds): byes go through by name, the
    // one round-1 match is "Winner of A v B".
    const fed = bracket[1].pairs[roundOneMatch.pairing >> 1];
    const waiting = fed.sides[roundOneMatch.pairing & 1];
    expect(waiting).toMatchObject({
      userId: null,
      placeholder: true,
      name: `Winner of ${roundOneMatch.side_0_name} v ${roundOneMatch.side_1_name}`,
    });
    expect(bracket[1].pairs.flatMap((p) => p.sides).filter((s) => s.placeholder)).toHaveLength(1);
    expect(bracket[2].pairs[1].sides.map((s) => s.name)).toEqual([
      "Winner, Quarters 3",
      "Winner, Quarters 4",
    ]);
    expect(bracket[3].pairs[0].sides.map((s) => s.name)).toEqual([
      "Winner, Semis 1",
      "Winner, Semis 2",
    ]);
    expect(bracket.flatMap((r) => r.pairs).filter((p) => p.kind === "played")).toHaveLength(0);
    // Auto squads are marked from the lock; a placeholder never is.
    const auto = round1.flatMap((p) => p.sides).filter((s) => s.auto);
    expect(auto.map((s) => s.userId)).toEqual([nine.entries[0].userId]);
  });

  it("names who meet once the round before is at full time", () => {
    const bracket = bracketOf(upTo(1));
    expect(bracket[0].played).toBe(true);
    for (const pair of bracket[1].pairs) {
      expect(pair.kind).toBe("upcoming");
      expect(pair.sides.some((s) => s.placeholder)).toBe(false);
      const feeders = [2 * pair.pairing, 2 * pair.pairing + 1].map(
        (p) => rows.find((row) => row.round === 1 && row.pairing === p)!.winner_user_id,
      );
      expect(pair.sides.map((s) => s.userId)).toEqual(feeders);
    }
    expect(bracket[2].pairs[0].sides.map((s) => s.name)).toEqual([
      "Winner, Quarters 1",
      "Winner, Quarters 2",
    ]);
  });

  it("reads the same before the draw view exists: round 1 from its revealed rows", () => {
    expect(bracketOf(upTo(1), false)).toEqual(bracketOf(upTo(1)));
  });

  it("describes a pairing in one sentence in every state, penalties included", () => {
    const shootout = rows.find((row) => row.side_0_penalties !== null)!;
    expect(matchSentence(shootout)).toMatch(
      /^Manager \w+ (\d+), Manager \w+ \1, \d+–\d+ on penalties\. Manager \w+ won\.$/,
    );
    const [round1] = bracketOf([]);
    expect(pairSentence(round1.pairs.find((p) => p.kind === "bye")!)).toMatch(
      /^Manager \w+ has a bye, which counts as a win\.$/,
    );
    expect(pairSentence(round1.pairs.find((p) => p.kind === "upcoming")!)).toBe(
      `${roundOneMatch.side_0_name} v ${roundOneMatch.side_1_name}, kick-off 20:30.`,
    );
  });

  it("jumps to the member's next match until they have none left", () => {
    const byeUser = draw.find((row) => row.bye)!.side_0_user_id;
    expect(yourNextRound(bracketOf([]), byeUser)?.round).toBe(2);
    expect(yourNextRound(bracketOf([]), roundOneMatch.side_0_user_id)?.round).toBe(1);
    expect(yourNextRound(bracketOf(rows), nine.championUserId)).toBeNull();
    expect(yourNextRound(bracketOf([]), "nobody")).toBeNull();
  });
});

describe("the evening from the lock (ADR-113)", () => {
  // A version-2 week: lock 19:55, round 1 at 20:00, a round every 15 minutes.
  const LOCK2 = "2026-10-14T17:55:00.000Z";
  const at = (hhmm: string) => new Date(`2026-10-14T${hhmm}:00+02:00`);
  const stops = (now: string, matches: readonly MatchRow[], youThrough: number | null = 2) =>
    eveningStops({
      lockAt: LOCK2,
      scheduleVersion: 2,
      rounds: 4,
      now: at(now),
      matches,
      youThrough,
    });

  it("marks the clock locked, played, live, next and later", () => {
    const draw = stops("19:57", []);
    expect(draw.map((s) => s.state)).toEqual(["locked", "next", "later", "later", "later"]);
    expect(draw.map((s) => s.time)).toEqual(["19:55", "20:00", "20:15", "20:30", "20:45"]);
    expect(draw.map((s) => s.name)).toEqual(["Lock", "Round 1", "Quarters", "Semis", "Final"]);
    expect(draw.map((s) => s.you)).toEqual([false, true, true, false, false]);
    // Revealed whole at kick-off today, so a round is played once its rows show.
    expect(stops("20:16", upTo(2)).map((s) => s.state)).toEqual([
      "locked",
      "played",
      "played",
      "next",
      "later",
    ]);
    // A round that has kicked off without every result yet is live (ADR-106's
    // per-event views, or a read a moment before the reveal).
    expect(stops("20:16", upTo(1)).map((s) => s.state)).toEqual([
      "locked",
      "played",
      "live",
      "next",
      "later",
    ]);
    expect(stops("19:50", []).map((s) => s.state)).toEqual([
      "next",
      "later",
      "later",
      "later",
      "later",
    ]);
    expect(stops("19:57", [], null).every((s) => !s.you)).toBe(true);
  });

  it("reads the clock as one sentence", () => {
    expect(eveningClockLabel(stops("20:16", upTo(2)))).toBe(
      "Wednesday evening: Lock 19:55, locked; Round 1 20:00, played, you're in; Quarters 20:15, played, you're in; Semis 20:30, next; Final 20:45, later.",
    );
  });

  it("marks the rounds a member is in: up to the one they went out in, or all", () => {
    const out = rows.find((row) => row.round === 2 && !row.bye)!;
    const loser = out.winner_side === 0 ? out.side_1_user_id! : out.side_0_user_id;
    const night = (userId: string) =>
      myNight({ userId, rounds: 4, lockAt: LOCK, scheduleVersion: V1, matches: rows });
    expect(roundsYouAreIn(night(loser), true, 4)).toBe(2);
    expect(roundsYouAreIn(night(nine.championUserId), true, 4)).toBe(4);
    expect(roundsYouAreIn(night("nobody"), false, 4)).toBeNull();
  });

  it("picks the page and its title from the kick-offs and the member's night", () => {
    const phase = (now: string, userId: string, matches: readonly MatchRow[]) =>
      eveningPhase({
        rounds: 4,
        lockAt: LOCK2,
        scheduleVersion: 2,
        now: at(now),
        night: myNight({ userId, rounds: 4, lockAt: LOCK2, scheduleVersion: 2, matches }),
      });
    expect(phase("19:57", nine.championUserId, [])).toEqual({
      kind: "draw",
      round: 0,
      title: "The draw is out",
    });
    expect(phase("20:01", nine.championUserId, upTo(1))).toMatchObject({
      kind: "round",
      round: 1,
      title: "Round 1 is live",
    });
    expect(phase("20:16", nine.championUserId, upTo(2)).title).toBe("Quarter-finals are live");
    const out = rows.find((row) => row.round === 2 && !row.bye)!;
    const loser = out.winner_side === 0 ? out.side_1_user_id! : out.side_0_user_id;
    expect(phase("20:16", loser, upTo(2))).toMatchObject({ kind: "out", title: "You’re out" });
    expect(phase("20:46", loser, rows)).toMatchObject({
      kind: "final",
      round: 4,
      title: "The final is live",
    });
    expect(phase("20:16", "nobody", upTo(2)).kind).toBe("round");
  });

  it("says who a member meets first, and after a bye both possible opponents", () => {
    const first = (userId: string, rowsOfDraw: readonly DrawRow[] = draw) =>
      firstMatch({ userId, draw: rowsOfDraw, rounds: 4, lockAt: LOCK2, scheduleVersion: 2 });
    expect(first(roundOneMatch.side_0_user_id)).toEqual({
      round: 1,
      kickoffAt: "2026-10-14T18:00:00.000Z",
      text: `You meet ${roundOneMatch.side_1_name} at 20:00.`,
      opponentIds: [roundOneMatch.side_1_user_id],
    });
    const neighbour = draw.find((row) => row.pairing === (roundOneMatch.pairing ^ 1))!;
    expect(neighbour.bye).toBe(true);
    expect(first(neighbour.side_0_user_id)).toEqual({
      round: 2,
      kickoffAt: "2026-10-14T18:15:00.000Z",
      text: `Round 1 is a bye for you, which counts as a win (+${roundPayouts(4)[0]}). In the quarter-finals you meet the winner of ${roundOneMatch.side_0_name} v ${roundOneMatch.side_1_name}.`,
      opponentIds: [roundOneMatch.side_0_user_id, roundOneMatch.side_1_user_id],
    });
    const lonely = draw.find((row) => row.bye && row.pairing >> 1 !== roundOneMatch.pairing >> 1)!;
    const other = draw.find((row) => row.pairing === (lonely.pairing ^ 1))!;
    expect(first(lonely.side_0_user_id)?.text).toMatch(
      new RegExp(`In the quarter-finals you meet ${other.side_0_name}\\.$`),
    );
    expect(first(lonely.side_0_user_id)?.opponentIds).toEqual([other.side_0_user_id]);
    expect(first("nobody")).toBeNull();
  });

  it("lists an entered five with the lock's numbers and none of the week's dice", () => {
    const card = (slot: number, extra: Partial<EntryCardRow>): EntryCardRow => ({
      tournament_id: "t",
      week_start: "2026-10-12",
      user_id: "u",
      manager_name: "Sanne",
      auto: true,
      keeper_slot: 1,
      keeperless: false,
      slot,
      trialist: false,
      player_id: `p${slot}`,
      player_name: `Player ${slot}`,
      photo_path: null,
      ovr: 40,
      archetype: "all_rounder",
      injured: false,
      ovr_factor_ppm: 1_000_000,
      form_roll_ppm: null,
      pick_factor_ppm: null,
      fitness_ppm: 1_000_000,
      handicap_ppm: 575_000,
      power_ppm: null,
      picks: null,
      owners: null,
      ...extra,
    });
    const five = fiveOf(
      [
        card(1, { archetype: "goalkeeper", ovr: 54, injured: true }),
        card(0, {}),
        card(2, { trialist: true, player_id: null, player_name: null, ovr: 30 }),
        card(0, { user_id: "other" }),
      ],
      "u",
    );
    expect(five).toEqual({
      userId: "u",
      manager: "Sanne",
      auto: true,
      cards: [
        {
          slot: 0,
          name: "Player 0",
          detail: "All-rounder · Bronze · 40",
          mini: { rarityTier: "bronze", ovr: 40, injured: false },
        },
        {
          slot: 1,
          name: "Player 1",
          detail: "Goalkeeper · Silver · 54 · in goal",
          mini: { rarityTier: "silver", ovr: 54, injured: true },
        },
        { slot: 2, name: "Trialist", detail: "Common All-rounder · 30", mini: null },
      ],
    });
    expect(fiveOf([], "u")).toBeNull();
  });

  it("lists past weeks newest first, with the member's finish or why nothing was played", () => {
    const week = (
      week_start: string,
      status: MidweekTournament["status"],
      extra: Partial<MidweekTournament> = {},
    ): MidweekTournament => ({
      tournament_id: week_start,
      week_start,
      lock_at: new Date(Date.parse(`${week_start}T17:55:00.000Z`) + 2 * 86_400_000).toISOString(),
      status,
      status_reason: null,
      void_note: null,
      rounds: 5,
      champion_user_id: "w",
      champion_name: "Wout H.",
      ...extra,
    });
    const entrants = [
      ...Array.from({ length: 21 }, (_, i) => ({ tournament_id: "2026-09-28", user_id: `x${i}` })),
      { tournament_id: "2026-09-28", user_id: "me" },
      { tournament_id: "2026-09-21", user_id: "me" },
      { tournament_id: "2026-09-21", user_id: "w" },
    ];
    const rewards = [
      { tournament_id: "2026-09-28", round_no: 1, amount: 17 },
      { tournament_id: "2026-09-28", round_no: 2, amount: 33 },
      { tournament_id: "2026-09-28", round_no: 3, amount: 50 },
    ];
    const weeks = pastWeeks({
      tournaments: [
        week("2026-09-21", "complete"),
        week("2026-10-12", "open"),
        week("2026-10-05", "simulated"),
        week("2026-09-28", "complete"),
        week("2026-09-14", "skipped", { status_reason: "club_break" }),
        week("2026-09-07", "skipped", { status_reason: "too_few_entrants" }),
        week("2026-08-31", "void", { void_note: "Pitch flooded" }),
        week("2026-08-24", "complete", { champion_user_id: "me", champion_name: "Me" }),
      ],
      entrants,
      rewards,
      userId: "me",
      minEntrants: 4,
    });
    expect(weeks.map((w) => [w.weekStart, w.text])).toEqual([
      ["2026-09-28", "Wout H. won it · 22 entrants. You: semi-finals, +100."],
      ["2026-09-21", "Wout H. won it · 2 entrants. You: round 1."],
      ["2026-09-14", "No Midweek Madness: the club was on a break. Nothing played or paid."],
      ["2026-09-07", "No Midweek Madness: fewer than 4 clubs were in. Nothing played or paid."],
      ["2026-08-31", "Called off by an admin. No results, and nothing paid."],
      ["2026-08-24", "Me won it · 0 entrants. You: champion, +0."],
    ]);
    // The row's date is the Wednesday of the lock.
    expect(weeks[0].date).toBe(formatDayDate("2026-09-30T17:55:00.000Z"));
    expect(weeks[0].weekStart).toBe("2026-09-28");
    expect(
      pastWeeks({
        tournaments: [week("2026-09-21", "complete")],
        entrants: [],
        rewards: [],
        userId: "me",
        minEntrants: 4,
      })[0].text,
    ).toBe("Wout H. won it · 0 entrants. You sat it out.");
    // Out in round 1 of a three-round week: that round is the quarter-finals.
    expect(
      pastWeeks({
        tournaments: [week("2026-09-21", "complete", { rounds: 3 })],
        entrants: [{ tournament_id: "2026-09-21", user_id: "me" }],
        rewards: [],
        userId: "me",
        minEntrants: 4,
      })[0].text,
    ).toBe("Wout H. won it · 1 entrants. You: quarter-finals.");
  });
});

describe("your night", () => {
  const pays = roundPayouts(4);

  it("follows the champion to 250 coins and a Champion finish", () => {
    const night = myNight({
      userId: nine.championUserId,
      rounds: 4,
      lockAt: LOCK,
      scheduleVersion: V1,
      matches: rows,
    });
    expect(night.champion).toBe(true);
    expect(night.coins).toBe(250);
    expect(night.rows.at(-1)!.kind).toBe("won");
    expect(finishStat(night, 4)).toEqual({ value: "Champion", note: "won the final" });
    expect(wonRounds(night)).toEqual(new Set([1, 2, 3, 4]));
  });

  it("stops at the round a member went out in, with no coins for it", () => {
    const final = rows.find((row) => row.round === 4)!;
    const loser = final.winner_side === 0 ? final.side_1_user_id! : final.side_0_user_id;
    const night = myNight({
      userId: loser,
      rounds: 4,
      lockAt: LOCK,
      scheduleVersion: V1,
      matches: rows,
    });
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
      scheduleVersion: V1,
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
    expect(liveLine(night, 4, LOCK, V1)).toMatch(
      /^You had a bye\. Quarter-final against Manager \w+ at 21:00\.$/,
    );
  });

  it("is empty for a member who isn't in the bracket", () => {
    const night = myNight({
      userId: "someone-else",
      rounds: 4,
      lockAt: LOCK,
      scheduleVersion: V1,
      matches: rows,
    });
    expect(night).toMatchObject({ entered: false, coins: 0, rows: [] });
    expect(finishStat(night, 4)).toEqual({ value: "—", note: "sat it out" });
    expect(liveLine(night, 4, LOCK, V1)).toBe("The final is at 22:00.");
  });

  it("scores from your side first, and says how you went out", () => {
    const shootout = rows.find((row) => row.side_0_penalties !== null && row.round < 4)!;
    const loser = shootout.winner_side === 0 ? shootout.side_1_user_id! : shootout.side_0_user_id;
    const night = myNight({
      userId: loser,
      rounds: 4,
      lockAt: LOCK,
      scheduleVersion: V1,
      matches: rows,
    });
    const out = night.rows.at(-1)!;
    expect(out.kind).toBe("out");
    if (out.kind !== "out") return;
    const mine = shootout.side_0_user_id === loser ? 0 : 1;
    const [my, their] =
      mine === 0
        ? [shootout.side_0_penalties, shootout.side_1_penalties]
        : [shootout.side_1_penalties, shootout.side_0_penalties];
    expect(out.score).toMatch(new RegExp(`^(\\d+)–\\1, ${my}–${their} on penalties$`));
    expect(liveLine(night, 4, LOCK, V1)).toMatch(/^You went out to Manager \w+ on penalties\./);
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

describe("Home's evening card (ADR-114)", () => {
  const LOCK2 = "2026-10-14T17:55:00.000Z";
  const at = (hhmm: string) => new Date(`2026-10-14T${hhmm}:00+02:00`);
  const card = (now: string, userId: string, matches: readonly MatchRow[]) =>
    homeEvening({
      userId,
      weekStart: "2026-10-12",
      rounds: 4,
      lockAt: LOCK2,
      scheduleVersion: 2,
      now: at(now),
      draw,
      matches,
    });
  const final = rows.find((row) => row.round === 4)!;
  const finalist = final.side_0_user_id;
  const report = (match: MatchRow) => `/midweek/2026-10-12/match/${match.match_id}`;

  it("from the lock: who you meet, and the way to the draw", () => {
    expect(card("19:57", roundOneMatch.side_0_user_id, [])).toEqual({
      kicker: "Midweek Madness · The draw",
      title: "The draw is out",
      line: `You meet ${roundOneMatch.side_1_name} at 20:00.`,
      match: null,
      button: { label: "See the draw", href: "/midweek" },
    });
    expect(card("19:57", "nobody", []).line).toBe("Round 1 kicks off at 20:00.");
  });

  it("your match this round at full time: the scoreboard and its report", () => {
    const played = rows.find((row) => row.round === 1 && !row.bye)!;
    const winner = played.winner_user_id!;
    const loser = played.winner_side === 0 ? played.side_1_user_id! : played.side_0_user_id;
    expect(card("20:05", winner, upTo(1))).toMatchObject({
      kicker: "Midweek Madness · Round 1",
      match: played,
      button: { label: "See the report", href: report(played) },
    });
    // Out is out: the card points at the final from the moment you lose (HANDOFF).
    expect(card("20:05", loser, upTo(1))).toMatchObject({
      match: played,
      button: { label: "Follow the final", href: "/midweek" },
    });
  });

  it("a bye, or not entered: the evening's title and your night in a line", () => {
    const bye = rows.find((row) => row.round === 1 && row.bye)!;
    expect(card("20:05", bye.side_0_user_id, upTo(1))).toMatchObject({
      title: "Round 1 is live",
      match: null,
      button: { label: "Follow the bracket", href: "/midweek" },
    });
    expect(card("20:05", bye.side_0_user_id, upTo(1)).line).toMatch(/^You had a bye\./);
    expect(card("20:05", "nobody", upTo(1))).toMatchObject({
      match: null,
      title: "Round 1 is live",
    });
  });

  it("from the final's kick-off: the final for everyone", () => {
    expect(card("20:50", finalist, rows)).toMatchObject({
      kicker: "Midweek Madness · The final",
      match: final,
      button: { label: "See the report", href: report(final) },
    });
    expect(card("20:50", "nobody", rows)).toMatchObject({
      match: final,
      button: { label: "Follow the final", href: "/midweek" },
    });
  });

  it("a match in play (ADR-115) stays on the card, to watch", () => {
    const playing = { ...final, winner_side: null, winner_user_id: null, in_play: true };
    const inPlay = rows.map((row) => (row === final ? playing : row));
    expect(card("20:47", finalist, inPlay)).toMatchObject({
      match: playing,
      button: { label: "Watch your match", href: report(final) },
    });
    expect(card("20:47", "nobody", inPlay)).toMatchObject({
      match: playing,
      button: { label: "Follow the final", href: "/midweek" },
    });
  });
});

describe("the evening in play (ADR-115)", () => {
  const LOCK2 = "2026-10-14T17:55:00.000Z";
  const playing = (row: MatchRow): MatchRow => ({
    ...row,
    side_0_goals: null,
    side_1_goals: null,
    side_0_penalties: null,
    side_1_penalties: null,
    winner_side: null,
    winner_user_id: null,
    in_play: true,
  });
  const round2 = rows.find((row) => row.round === 2 && !row.bye)!;
  const inPlay = upTo(2).map((row) => (row === round2 ? playing(row) : row));

  it("your night says you are playing, and stops there", () => {
    const you = round2.side_0_user_id;
    const night = myNight({
      userId: you,
      rounds: 4,
      lockAt: LOCK2,
      scheduleVersion: 2,
      matches: inPlay,
    });
    expect(night.rows.at(-1)).toEqual({
      kind: "live",
      round: 2,
      revealAt: "2026-10-14T18:15:00.000Z",
      opponent: round2.side_1_name,
      matchId: round2.match_id,
      coins: roundPayouts(4)[1],
    });
    expect(night.alive).toBe(true);
    expect(night.coins).toBe(
      night.rows.filter((row) => row.kind !== "live").reduce((s, r) => s + r.coins, 0),
    );
    expect(liveLine(night, 4, LOCK2, 2)).toBe(`Playing ${round2.side_1_name} now.`);
  });

  it("the bracket shows it in play, names its winner-to-be as a placeholder, and the clock says Live", () => {
    const bracket = assembleBracket({
      rounds: 4,
      lockAt: LOCK2,
      scheduleVersion: 2,
      draw,
      matches: inPlay,
      autoUserIds: new Set(),
    });
    const pair = bracket[1].pairs[round2.pairing];
    expect(pair.kind).toBe("inplay");
    expect(pair.kind === "inplay" && pair.final).toBe(false);
    expect(pairSentence(pair)).toMatch(/, in play\. The result shows at full time\.$/);
    expect(bracket[1].played).toBe(false);
    const next = bracket[2].pairs[round2.pairing >> 1];
    expect(next.kind).toBe("upcoming");
    expect(next.sides.some((side) => side.placeholder)).toBe(true);
    const stops = eveningStops({
      lockAt: LOCK2,
      scheduleVersion: 2,
      rounds: 4,
      now: new Date("2026-10-14T18:17:00.000Z"),
      matches: inPlay,
      youThrough: null,
    });
    expect(stops[2].state).toBe("live");
  });
});

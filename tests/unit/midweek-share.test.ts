import { describe, expect, it } from "vitest";
import { nightRatings } from "@/lib/midweek/night-ratings";
import type { MatchRow } from "@/lib/midweek/rows";
import {
  finishWord,
  nightTiles,
  posterTiles,
  shareFileName,
  shareImages,
  shareTop,
} from "@/lib/midweek/share";
import {
  directory,
  entryRows,
  eventRows,
  matchRow,
  simulated,
} from "../support/midweek-stored-rows";

/**
 * The share images' words and numbers (DR3 HANDOFF §3, ADR-120). The drawing
 * itself runs on a browser canvas and is checked end to end; everything it
 * writes comes from here.
 */

const LOCK = "2026-10-07T17:55:00.000Z";

function row(
  round: number,
  pairing: number,
  a: [string, string],
  b: [string, string] | null,
  goals: [number, number] = [0, 0],
  penalties: [number, number] | null = null,
  winner: 0 | 1 = 0,
): MatchRow {
  return {
    match_id: `r${round}-${pairing}`,
    tournament_id: "t",
    week_start: "2026-10-05",
    round,
    pairing,
    bye: b === null,
    side_0_user_id: a[0],
    side_0_name: a[1],
    side_1_user_id: b?.[0] ?? null,
    side_1_name: b?.[1] ?? null,
    side_0_goals: b ? goals[0] : null,
    side_1_goals: b ? goals[1] : null,
    side_0_penalties: penalties?.[0] ?? null,
    side_1_penalties: penalties?.[1] ?? null,
    winner_side: winner,
    winner_user_id: winner === 0 ? a[0] : (b?.[0] ?? null),
    win_chance_ppm: 500_000,
    side_0_day_rolls_ppm: [],
    side_1_day_rolls_ppm: [],
    reveal_at: LOCK,
  };
}

// Joris: a bye, 7–0 over Emma, 4–0 over Wessel, 1–0 over Julia, and the final
// on penalties against Sophie, 1–1 and 5–4, from side 1.
const JORIS = ["j", "Joris"] as [string, string];
const SANNE = ["s", "Sanne"] as [string, string];
const path: MatchRow[] = [
  row(1, 0, JORIS, null),
  row(2, 0, JORIS, ["e", "Emma"], [7, 0]),
  row(3, 0, ["w", "Wessel"], JORIS, [0, 4], null, 1),
  row(4, 0, JORIS, ["u", "Julia"], [1, 0]),
  row(5, 0, ["p", "Sophie"], JORIS, [1, 1], [4, 5], 1),
  row(1, 1, SANNE, null),
  row(2, 1, ["l", "Eline"], SANNE, [0, 1], null, 1),
  row(3, 1, ["p", "Sophie"], SANNE, [2, 2], [7, 6], 0),
];

describe("share image copy", () => {
  it("dates the images and names the files", () => {
    expect(shareTop(LOCK)).toBe("Midweek Madness · Wed 7 Oct 2026");
    expect(shareFileName(LOCK, "champion")).toBe("flut-midweek-7-oct-champion.png");
    expect(shareFileName(LOCK, "Sanne")).toBe("flut-midweek-7-oct-sanne.png");
    expect(shareFileName(LOCK, "Anne-Sophie Vél")).toBe("flut-midweek-7-oct-anne-sophie-vel.png");
  });

  it("writes the poster's path as score and opponent, the final on penalties included", () => {
    expect(posterTiles(path, "j", 5)).toEqual([
      { round: "Round 1", text: "Bye", out: false },
      { round: "Round 2", text: "7–0 Emma", out: false },
      { round: "Quarters", text: "4–0 Wessel", out: false },
      { round: "Semis", text: "1–0 Julia", out: false },
      { round: "Final", text: "1–1, 5–4 pens Sophie", out: false },
    ]);
  });

  it("writes my night's path from the member's side, the defeat marked out", () => {
    expect(nightTiles(path, "s", 5)).toEqual([
      { round: "Round 1", text: "Bye", out: false },
      { round: "Round 2", text: "Beat Eline 1–0", out: false },
      { round: "Quarters", text: "Lost to Sophie on pens, 6–7", out: true },
    ]);
  });

  it("names the finish in the serif", () => {
    const out = (round: number) => ({
      champion: false,
      rows: [
        {
          kind: "out" as const,
          round,
          revealAt: LOCK,
          opponent: "x",
          score: "0–1",
          penalties: false,
          matchId: "m",
          coins: 0,
        },
      ],
    });
    expect(finishWord({ champion: true, rows: [] }, 5)).toBe("Champion");
    expect(finishWord(out(5), 5)).toBe("Final");
    expect(finishWord(out(4), 5)).toBe("Semi-finals");
    expect(finishWord(out(3), 5)).toBe("Quarter-finals");
    expect(finishWord(out(1), 5)).toBe("Round 1");
  });
});

describe("share images from a stored week", () => {
  const t = simulated.find((s) => s.result.byes.length > 0) ?? simulated[0];
  const { result, seedHash } = t;
  const matches: MatchRow[] = [
    ...result.byes.map((bye) => ({
      ...matchRow(result.matches[0]),
      match_id: `bye-${bye.pairing}`,
      round: 1,
      pairing: bye.pairing,
      bye: true,
      side_0_user_id: bye.userId,
      side_0_name: directory.manager(bye.userId),
      side_1_user_id: null,
      side_1_name: null,
      side_0_goals: null,
      side_1_goals: null,
      winner_side: 0 as const,
      winner_user_id: bye.userId,
    })),
    ...result.matches.map(matchRow),
  ];
  const entries = entryRows(result, true);
  const events = result.matches.flatMap(eventRows);
  const final = result.matches.find((m) => m.round === result.rounds)!;
  const championId = final.userIds[final.outcome.winnerSide];
  const loserId = final.userIds[final.outcome.winnerSide === 0 ? 1 : 0];
  const rate = (userId: string) =>
    nightRatings({
      seedHash,
      userId,
      rounds: result.rounds,
      weekStart: "2026-10-05",
      matches,
      events,
      entries,
      photoUrls: new Map(),
    })!;
  const rated = new Map([
    [championId, rate(championId)],
    [loserId, rate(loserId)],
  ]);
  const images = (userId: string, calls = { right: 0, picks: 0 }) =>
    shareImages({
      lockAt: LOCK,
      rounds: result.rounds,
      scheduleVersion: 2,
      userId,
      championId,
      championName: directory.manager(championId),
      matches,
      entries,
      ratings: rated,
      coins: 54,
      calls,
    });

  it("draws the champion's five in slot order with their night ratings, a tile per round", () => {
    const { poster } = images(loserId);
    expect(poster!.champion).toBe(directory.manager(championId));
    expect(poster!.cards).toHaveLength(5);
    expect(poster!.cards.map((card) => card.rating)).toEqual(
      [...rated.get(championId)!.cards].sort((a, b) => a.slot - b.slot).map((card) => card.rating),
    );
    expect(poster!.tiles).toHaveLength(result.rounds);
    expect(poster!.line).toMatch(/^Beat .+ (on penalties )?in the final, /);
    expect(poster!.fileName).toBe("flut-midweek-7-oct-champion.png");
  });

  it("gives the runner-up their night, the best card ringed and its line, and the calls in the foot", () => {
    const { night } = images(loserId, { right: 2, picks: 3 });
    expect(night!.finish).toBe("Final");
    expect(night!.coins).toBe(54);
    expect(night!.tiles.at(-1)!.out).toBe(true);
    const best = night!.cards[night!.best];
    expect(best.rating).toBe(Math.max(...night!.cards.map((card) => card.rating)));
    expect(night!.bestLine).toBe(rated.get(loserId)!.cards.find((card) => card.best)!.line);
    expect(night!.foot).toBe(`Called 2 of 3 · ${directory.manager(championId)} won it`);
    expect(images(loserId).night!.foot).toBe(`${directory.manager(championId)} won it`);
  });

  it("gives a member who didn't enter the poster only", () => {
    const { poster, night } = images("not-entered");
    expect(poster).not.toBeNull();
    expect(night).toBeNull();
  });
});

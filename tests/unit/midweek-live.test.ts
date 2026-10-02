import { describe, expect, it } from "vitest";
import { liveView, maskInPlay } from "@/lib/midweek/live";
import type { ShootoutKick, TimelineItem } from "@/lib/midweek/report/types";
import type { MatchRow } from "@/lib/midweek/rows";

const row = (id: string, extra: Partial<MatchRow> = {}): MatchRow => ({
  match_id: id,
  tournament_id: "t",
  week_start: "2026-10-12",
  round: 1,
  pairing: 0,
  bye: false,
  side_0_user_id: "a",
  side_0_name: "Sanne",
  side_1_user_id: "b",
  side_1_name: "Eline",
  side_0_goals: 1,
  side_1_goals: 0,
  side_0_penalties: null,
  side_1_penalties: null,
  winner_side: 0,
  winner_user_id: "a",
  win_chance_ppm: 460_000,
  side_0_day_rolls_ppm: [],
  side_1_day_rolls_ppm: [],
  reveal_at: "2026-10-14T18:00:00.000Z",
  ...extra,
});

describe("maskInPlay (ADR-115)", () => {
  const now = new Date("2026-10-14T18:03:00.000Z");

  it("withholds the result of a match whose stored end is still ahead", () => {
    const [masked] = maskInPlay([row("m")], new Map([["m", "2026-10-14T18:04:40.000Z"]]), now);
    expect(masked).toMatchObject({
      in_play: true,
      side_0_goals: null,
      side_1_goals: null,
      winner_side: null,
      winner_user_id: null,
    });
  });

  it("shows a match that has ended, a bye, and a week with no stored times whole", () => {
    const [ended, bye, old] = maskInPlay(
      [row("ended"), row("bye", { bye: true, side_1_user_id: null }), row("old")],
      new Map([
        ["ended", "2026-10-14T18:02:00.000Z"],
        ["old", null],
      ]),
      now,
    );
    expect(ended).toMatchObject({ in_play: false, winner_side: 0, side_0_goals: 1 });
    expect(bye.in_play).toBe(false);
    expect(old).toMatchObject({ in_play: false, winner_side: 0 });
  });

  it("keeps in play a match the view already withholds (ADR-106), with no end to read", () => {
    const [withheld] = maskInPlay(
      [
        row("m", {
          winner_side: null,
          winner_user_id: null,
          side_0_goals: null,
          side_1_goals: null,
        }),
      ],
      new Map(),
      now,
    );
    expect(withheld.in_play).toBe(true);
  });
});

describe("liveView (ADR-115)", () => {
  const moment = (
    minute: number,
    side: 0 | 1,
    score: [number, number],
    kind: TimelineItem["kind"] = "goal",
  ): TimelineItem => ({
    minute,
    side,
    kind,
    text: `${minute}`,
    parts: [{ text: `${minute}` }],
    score,
  });
  const timeline = [moment(10, 1, [0, 0], "save"), moment(39, 0, [1, 0]), moment(80, 1, [1, 1])];
  const kick = (side: 0 | 1, outcome: ShootoutKick["outcome"]): ShootoutKick => ({
    side,
    round: 1,
    kicker: side === 0 ? "Gijs H." : "Ayla D.",
    outcome,
  });
  const kicks = [kick(0, "goal"), kick(1, "goal"), kick(0, "save"), kick(1, "goal")];
  const at = (seconds: number) => new Date(Date.parse("2026-10-14T18:15:00.000Z") + seconds * 1000);
  const view = (seconds: number) =>
    liveView({
      timeline,
      kicks,
      kickoffAt: "2026-10-14T18:15:00.000Z",
      scheduleVersion: 2,
      now: at(seconds),
    });

  it("reveals each chance at kick-off + minute × 280 s / 90, with the score so far", () => {
    // Minute 39 is due at 121.33 s.
    expect(view(121).timeline.map((m) => m.minute)).toEqual([10]);
    expect(view(122).timeline.map((m) => m.minute)).toEqual([10, 39]);
    expect(view(122).score).toEqual([1, 0]);
    expect(view(122).minute).toBe(39);
    expect(view(0).score).toEqual([0, 0]);
  });

  it("caps the clock at 90 and reveals the kicks one every 5 seconds after full time", () => {
    expect(view(280).minute).toBe(90);
    expect(view(280).shootout).toBe(true);
    expect(view(280).kicks).toEqual([]);
    expect(view(280).penalties).toEqual([0, 0]);
    expect(view(290).kicks).toHaveLength(2);
    expect(view(290).penalties).toEqual([1, 1]);
    expect(view(300).penalties).toEqual([1, 2]);
    expect(view(279).shootout).toBe(false);
    expect(view(279).penalties).toBeNull();
  });

  it("a week on the old clock (version 1) shows everything at kick-off", () => {
    const old = liveView({
      timeline,
      kicks,
      kickoffAt: "2026-10-14T18:15:00.000Z",
      scheduleVersion: 1,
      now: at(0),
    });
    expect(old.timeline).toHaveLength(3);
  });
});

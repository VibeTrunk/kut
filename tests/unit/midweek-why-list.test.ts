import { describe, expect, it } from "vitest";
import { keepScores } from "@/components/midweek/player-name";
import { ordinal } from "@/components/midweek/report";
import {
  FACTOR_EXPLANATIONS,
  factorEffect,
  matchPower,
  powerBand,
  powerBarWidth,
} from "@/components/midweek/why-list";

describe("the match page's Why list (HANDOFF MidweekWhyList)", () => {
  it("shows a card's power in this match: the week's power times the Day roll", () => {
    expect(matchPower({ powerPpm: 1_100_000, dayRollPpm: 1_080_000 })).toBeCloseTo(1.188);
    expect(matchPower({ powerPpm: 575_000, dayRollPpm: 1_000_000 })).toBeCloseTo(0.575);
  });

  it("bands power by the number on screen", () => {
    expect(powerBand(1.19).word).toBe("strong");
    expect(powerBand(1.0951).word).toBe("strong"); // shows 1.10
    expect(powerBand(1.0949).word).toBe("above ordinary");
    expect(powerBand(1.0).word).toBe("above ordinary");
    expect(powerBand(0.9951).word).toBe("above ordinary"); // shows 1.00
    expect(powerBand(0.95).word).toBe("below ordinary");
    expect(powerBand(0.9).word).toBe("below ordinary");
    expect(powerBand(0.8949).word).toBe("weak");
  });

  it("draws the bar from 0.50 to 1.50 with an ordinary card at the middle", () => {
    expect(powerBarWidth(1)).toBe(50);
    expect(powerBarWidth(1.19)).toBe(69);
    expect(powerBarWidth(0.3)).toBe(2);
    expect(powerBarWidth(2)).toBe(100);
  });

  it("writes each factor as a signed percentage, or a dash when it changes nothing", () => {
    expect(factorEffect(1_190_000)).toEqual({ text: "+19%", trend: "up" });
    expect(factorEffect(930_000)).toEqual({ text: "−7%", trend: "down" });
    expect(factorEffect(1_000_000)).toEqual({ text: "–", trend: "flat" });
    expect(factorEffect(1_004_000)).toEqual({ text: "–", trend: "flat" });
  });

  it("explains every factor with the figures in MIDWEEK", () => {
    expect(FACTOR_EXPLANATIONS).toEqual({
      Rating: "From the card's OVR: no boost at OVR 30, up to +10% at OVR 83.",
      Form: "The Player's form this week, rolled once at the lock: from −20% to +25%, usually close to zero. Every copy of the Player shares it.",
      Pick: "Picking against the crowd pays: up to +25% when few owners picked this Player, down to −12.5% when nearly all of them did.",
      Fitness: "−5% when the Player is injured; otherwise no change.",
      Day: "A fresh roll for this match only, between −12% and +12%.",
    });
  });

  it("names a minute the way screen readers say it", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22, 39, 90].map(ordinal)).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "12th",
      "13th",
      "21st",
      "22nd",
      "39th",
      "90th",
    ]);
  });
});

describe("report text on a match page", () => {
  it("keeps a score on one line without changing what it says", () => {
    const kept = keepScores("a 3–0 defeat, 7–6 on penalties");
    expect(kept).not.toBe("a 3–0 defeat, 7–6 on penalties");
    expect(kept.replace(/\u2060/g, "")).toBe("a 3–0 defeat, 7–6 on penalties");
  });
});

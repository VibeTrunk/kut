import { describe, expect, it } from "vitest";
import { calculateGoalForm, calculateKudosForm, calculateSessionInput, calculateVersion2FormScore } from "@/game/rating-engine";

describe("rating v2 Form", () => {
  it("uses the specified goal and kudos ladders", () => {
    expect([null, 0, 1, 2, 3, 99].map(calculateGoalForm)).toEqual([0, 0, 1, 1.25, 1.5, 1.5]);
    expect([0, 1, 2, 3].map(calculateKudosForm)).toEqual([0, 1, 1.25, 1.5]);
    expect(calculateSessionInput(1, 1)).toBe(2);
    expect(calculateSessionInput(3, 3)).toBe(3);
    expect(() => calculateGoalForm(-1)).toThrow("Goals must be an integer from 0 to 99.");
  });

  it("matches the finalized SQL fixture for a single reported goal", () => {
    expect(calculateVersion2FormScore([{ sessionInput: calculateSessionInput(1, 0), age: 0 }], 0, 1)).toBe(1);
  });

  it("ages session input at 1/.75/.5/.25/0 and caps at eight", () => {
    expect(calculateVersion2FormScore([{ sessionInput: 3, age: 0 }], 0, 1)).toBe(3);
    expect(calculateVersion2FormScore([{ sessionInput: 3, age: 1 }], 0, 2)).toBe(2.25);
    expect(calculateVersion2FormScore([{ sessionInput: 3, age: 4 }], 0, 5)).toBe(0);
    expect(calculateVersion2FormScore([0, 1, 2, 3].map((age) => ({ sessionInput: 3, age })), 0, 4)).toBe(7.5);
  });

  it("tapers the legacy carry over the first four v2 sessions", () => {
    expect([1, 2, 3, 4].map((count) => calculateVersion2FormScore([], 8, count))).toEqual([6, 4, 2, 0]);
  });
});

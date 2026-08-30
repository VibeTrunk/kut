import { describe, expect, it } from "vitest";
import {
  initialRevealState,
  packRevealReducer,
  type RevealState,
} from "@/components/pack-reveal-state";

const CARDS = 3;
const step = (state: RevealState, action: Parameters<typeof packRevealReducer>[1]) =>
  packRevealReducer(state, action, CARDS);

describe("pack reveal state machine", () => {
  it("starts mid-reveal normally and instantly under reduced motion", () => {
    expect(initialRevealState(CARDS, false)).toEqual({ phase: "revealing", index: 0, step: 0 });
    expect(initialRevealState(CARDS, true)).toEqual({ phase: "summary" });
    expect(initialRevealState(0, false)).toEqual({ phase: "summary" });
  });

  it("walks rarity → ovr → identity, then to the next card", () => {
    let state = initialRevealState(CARDS, false);
    state = step(state, { type: "advance" });
    expect(state).toEqual({ phase: "revealing", index: 0, step: 1 });
    state = step(state, { type: "advance" });
    expect(state).toEqual({ phase: "revealing", index: 0, step: 2 });
    state = step(state, { type: "advance" });
    expect(state).toEqual({ phase: "revealing", index: 1, step: 0 });
  });

  it("lands on the summary after the last card's last step", () => {
    let state: RevealState = { phase: "revealing", index: CARDS - 1, step: 2 };
    state = step(state, { type: "advance" });
    expect(state).toEqual({ phase: "summary" });
    // Advancing again is a no-op.
    expect(step(state, { type: "advance" })).toEqual({ phase: "summary" });
  });

  it("skipAll jumps straight to the summary from anywhere", () => {
    expect(step({ phase: "revealing", index: 0, step: 0 }, { type: "skipAll" })).toEqual({ phase: "summary" });
    expect(step({ phase: "revealing", index: 2, step: 1 }, { type: "skipAll" })).toEqual({ phase: "summary" });
  });

  it("restart replays from the first card unless there are none", () => {
    expect(step({ phase: "summary" }, { type: "restart" })).toEqual({ phase: "revealing", index: 0, step: 0 });
    expect(packRevealReducer({ phase: "summary" }, { type: "restart" }, 0)).toEqual({ phase: "summary" });
  });
});

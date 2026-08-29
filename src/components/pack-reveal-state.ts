// Pure state machine for the pack / starter reveal animation (BUILD_SPEC §49).
// Kept in its own module so it can be unit-tested without pulling in React or
// next/link through pack-reveal.tsx.

// Steps a single card walks through before the next one:
//   0 = rarity clue, 1 = + OVR, 2 = full identity/photo.
export const LAST_STEP = 2;

export type RevealState =
  | { phase: "revealing"; index: number; step: number }
  | { phase: "summary" };

export type RevealAction = { type: "advance" } | { type: "skipAll" } | { type: "restart" };

export function initialRevealState(cardCount: number, instant: boolean): RevealState {
  if (instant || cardCount === 0) return { phase: "summary" };
  return { phase: "revealing", index: 0, step: 0 };
}

export function packRevealReducer(state: RevealState, action: RevealAction, cardCount: number): RevealState {
  switch (action.type) {
    case "skipAll":
      return { phase: "summary" };
    case "restart":
      return cardCount === 0 ? { phase: "summary" } : { phase: "revealing", index: 0, step: 0 };
    case "advance": {
      if (state.phase === "summary") return state;
      if (state.step < LAST_STEP) return { ...state, step: state.step + 1 };
      if (state.index + 1 < cardCount) return { phase: "revealing", index: state.index + 1, step: 0 };
      return { phase: "summary" };
    }
    default:
      return state;
  }
}

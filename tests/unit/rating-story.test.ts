import { describe, expect, it } from "vitest";
import {
  carriedForm,
  describeCarriedDecay,
  describeCarriedForm,
  describeContribution,
  describeDecay,
  describeFormTotal,
  describeRatingBase,
  formatForm,
  type FormContribution,
  type RatingBreakdown,
} from "@/lib/rating-story";

const breakdown: RatingBreakdown = {
  live_ovr: 66,
  form_score: 4.5,
  activity_score: 62.5,
  form_bonus: 5,
  attendance_base: 61,
  is_ovr_capped: false,
};

const contribution: FormContribution = {
  session_id: "s1",
  session_date: "2026-09-11",
  session_type: "friday",
  effective_goals: 3,
  goal_form: 1.5,
  kudos_form: 1.5,
  session_input: 3,
  session_age: 0,
  weight: 1,
  weighted_contribution: 3,
  recognized_categories: ["Team Player", "Engine"],
};

describe("describeRatingBase", () => {
  it("splits the rating into attendance and Form using the first name", () => {
    expect(describeRatingBase("Freek de Jong", breakdown)).toBe(
      "Freek is 66 OVR: 61 from match attendance, plus 5 from current Form.",
    );
  });

  it("omits the Form clause when there is no bonus", () => {
    expect(describeRatingBase("Freek", { ...breakdown, form_bonus: 0, attendance_base: 66 })).toBe(
      "Freek is 66 OVR: 66 from match attendance.",
    );
  });

  // The whole point of deriving the base as live_ovr - form_bonus.
  it("always reports halves that sum to the stated rating", () => {
    expect(breakdown.attendance_base + breakdown.form_bonus).toBe(breakdown.live_ovr);
  });
});

describe("describeContribution", () => {
  it("names goals and recognised categories in Form, never in OVR", () => {
    const line = describeContribution(contribution);
    expect(line).toBe("3 Form — 3 goals and Team Player, Engine");
    expect(line).not.toMatch(/OVR/);
  });

  it("uses the singular for a single goal", () => {
    expect(
      describeContribution({ ...contribution, effective_goals: 1, recognized_categories: null }),
    ).toBe("3 Form — 1 goal");
  });

  it("renders kudos alone when no goals were reported", () => {
    expect(describeContribution({ ...contribution, effective_goals: 0 })).toBe(
      "3 Form — Team Player, Engine",
    );
  });

  it("keeps decimal Form rather than rounding a single session", () => {
    expect(describeContribution({ ...contribution, weighted_contribution: 1.5 })).toBe(
      "1.5 Form — 3 goals and Team Player, Engine",
    );
  });

  it("drops a session that has faded to nothing", () => {
    expect(
      describeContribution({
        ...contribution,
        weighted_contribution: 0,
        session_age: 4,
        weight: 0,
      }),
    ).toBeNull();
  });

  it("falls back gracefully when neither goals nor categories are present", () => {
    expect(
      describeContribution({
        ...contribution,
        effective_goals: null,
        recognized_categories: [],
      }),
    ).toBe("3 Form — this session");
  });
});

describe("describeDecay", () => {
  it("says a current session counts in full", () => {
    expect(describeDecay(contribution)).toMatch(/counts in full$/);
  });

  // RATING_BALANCE_REVIEW: never equate four sessions with four weeks.
  it("describes fading as a percentage and never mentions weeks", () => {
    const text = describeDecay({ ...contribution, session_age: 1, weight: 0.75 });
    expect(text).toMatch(/fading, counts 75%$/);
    expect(text).not.toMatch(/week/i);
  });
});

describe("describeFormTotal", () => {
  it("states the total in Form and the bonus once in OVR", () => {
    expect(describeFormTotal(breakdown)).toBe(
      "4.5 Form in total, which lifts the rating by 5 OVR.",
    );
  });
});

describe("formatForm", () => {
  it("trims trailing zeros", () => {
    expect(formatForm(2)).toBe("2");
    expect(formatForm(1.5)).toBe("1.5");
    expect(formatForm(0.75)).toBe("0.75");
  });
});

// The live defect these cover: kut.player_form_contributions reads only
// session_report_results, so the Form a player carried over the rating-v2
// cutover was counted in form_score and in the OVR bonus but had no row.
describe("carriedForm", () => {
  // Stephen, 2026-09-16: rows of 1.00 and 1.25 under a stated total of 2.88.
  it("recovers the Form no listed session accounts for", () => {
    const listed = [
      { ...contribution, session_id: "a", weighted_contribution: 1 },
      { ...contribution, session_id: "b", weighted_contribution: 1.25 },
    ];
    expect(carriedForm({ ...breakdown, form_score: 2.875 }, listed)).toBe(0.63);
  });

  // Teize, 2026-09-16: "+2 from Form" over "this rating is all attendance".
  it("treats an entire Form score as carried when no session contributes", () => {
    expect(carriedForm({ ...breakdown, form_score: 1.5 }, [])).toBe(1.5);
  });

  it("reports nothing carried when the sessions already sum to the total", () => {
    expect(carriedForm({ ...breakdown, form_score: 3 }, [contribution])).toBe(0);
  });

  it("counts a faded session as zero rather than subtracting it", () => {
    const faded = { ...contribution, session_id: "z", weighted_contribution: 0, weight: 0 };
    expect(carriedForm({ ...breakdown, form_score: 3 }, [contribution, faded])).toBe(0);
  });

  // least(8, ...) in the engine: the sessions can exceed what Form keeps.
  it("goes negative when the 8 Form ceiling has clipped the total", () => {
    const big = { ...contribution, weighted_contribution: 9 };
    expect(carriedForm({ ...breakdown, form_score: 8 }, [big])).toBe(-1);
  });

  it("does not surface float noise as a phantom contribution", () => {
    const thirds = [0.1, 0.2].map((value, index) => ({
      ...contribution,
      session_id: `f${index}`,
      weighted_contribution: value,
    }));
    expect(carriedForm({ ...breakdown, form_score: 0.3 }, thirds)).toBe(0);
  });
});

describe("describeCarriedForm", () => {
  it("reads as one more Form row, never in OVR", () => {
    const line = describeCarriedForm(0.63);
    expect(line).toBe("0.63 Form — carried over from before session reports began");
    expect(line).not.toMatch(/OVR/);
  });

  it("trims a whole number like every other row", () => {
    expect(describeCarriedForm(1.5)).toMatch(/^1.5 Form/);
    expect(describeCarriedForm(2)).toMatch(/^2 Form/);
  });
});

describe("describeCarriedDecay", () => {
  // RATING_BALANCE_REVIEW: never equate four sessions with four weeks.
  it("fades in sessions and never mentions weeks", () => {
    expect(describeCarriedDecay()).toMatch(/fading with every new session$/);
    expect(describeCarriedDecay()).not.toMatch(/week/i);
  });
});

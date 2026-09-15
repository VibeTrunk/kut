import { describe, expect, it } from "vitest";
import {
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

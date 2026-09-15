import { formatDate } from "@/lib/format";

/**
 * Copy for the "why this rating" story (ADR-074).
 *
 * This module formats numbers that SQL already computed. It is deliberately not
 * a second rating engine: per ADR-064 the Form and OVR formulas live only in
 * `kut._rebuild_season_core`, and the two read projections
 * `kut.player_rating_breakdown` / `kut.player_form_contributions` are the single
 * read path. Nothing here recomputes a rating.
 *
 * Two rules from `docs/RATING_BALANCE_REVIEW.md` constrain the wording:
 *
 * 1. Form is rounded ONCE, on the total. Individual sessions therefore carry
 *    decimal Form, never a per-line "+N OVR" — those would not sum to the real
 *    figure. Only the combined bonus is stated in OVR.
 * 2. "Never equate four sessions with four weeks." Decay is counted in
 *    sessions, so the copy says sessions and names actual dates.
 *
 * Nominators are never named anywhere in this file; the views cannot even read
 * `kut.session_kudos`.
 */

export type RatingBreakdown = {
  live_ovr: number;
  form_score: number;
  activity_score: number;
  form_bonus: number;
  attendance_base: number;
  is_ovr_capped: boolean;
};

export type FormContribution = {
  session_id: string;
  session_date: string;
  session_type: string | null;
  effective_goals: number | null;
  goal_form: number;
  kudos_form: number;
  session_input: number;
  session_age: number;
  weight: number;
  weighted_contribution: number;
  recognized_categories: string[] | null;
};

/** Trims trailing zeros so 1.50 reads as "1.5" and 2.00 as "2". */
export function formatForm(value: number): string {
  return String(Number(value.toFixed(2)));
}

/**
 * The headline split. Always reconstructs the number on the card face, because
 * the base is derived as `live_ovr - form_bonus` rather than recomputed from the
 * attendance curve.
 */
export function describeRatingBase(name: string, breakdown: RatingBreakdown): string {
  const firstName = name.split(" ")[0];
  return `${firstName} is ${breakdown.live_ovr} OVR: ${breakdown.attendance_base} from match attendance${
    breakdown.form_bonus > 0 ? `, plus ${breakdown.form_bonus} from current Form` : ""
  }.`;
}

/**
 * One line per contributing session, e.g.
 * "1.5 Form — 3 goals and Team Player, Engine · Mon 1 Sep".
 * Returns null for a session that has faded to nothing, so the caller can drop
 * it rather than render a row of zeros.
 */
export function describeContribution(contribution: FormContribution): string | null {
  if (contribution.weighted_contribution <= 0) return null;

  const parts: string[] = [];
  const goals = contribution.effective_goals;
  if (goals && goals > 0) parts.push(`${goals} ${goals === 1 ? "goal" : "goals"}`);

  const categories = contribution.recognized_categories ?? [];
  if (categories.length > 0) parts.push(categories.join(", "));

  // A session can contribute Form through goals or kudos; if neither is
  // present there is nothing meaningful to name, so fall back to the session.
  const what = parts.length > 0 ? parts.join(" and ") : "this session";
  return `${formatForm(contribution.weighted_contribution)} Form — ${what}`;
}

/**
 * How much a session still counts. Sessions decay over the following few
 * sessions (never "weeks"), so a faded one is labelled as such.
 */
export function describeDecay(contribution: FormContribution): string {
  const when = formatDate(contribution.session_date);
  if (contribution.session_age === 0) return `${when} · counts in full`;
  return `${when} · fading, counts ${Math.round(contribution.weight * 100)}%`;
}

/**
 * The closing line tying the session rows back to the single rounding step.
 * Stated in Form, then the one OVR figure — never per line.
 */
export function describeFormTotal(breakdown: RatingBreakdown): string {
  return `${formatForm(breakdown.form_score)} Form in total, which lifts the rating by ${breakdown.form_bonus} OVR.`;
}

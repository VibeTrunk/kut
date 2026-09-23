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
  /**
   * ADR-083. A comeback-from-injury input shares its return session's id with
   * that session's own row. Optional because the column is newer than the
   * pages that read the view: until the hosted schema has it, every row is a
   * session row.
   */
  source?: "session" | "comeback";
  /** Protected injury weeks behind a comeback row; null on a session row. */
  protected_weeks?: number | null;
};

/** A stable React key: a comeback and its return session share a session_id. */
export function contributionKey(contribution: FormContribution): string {
  return `${contribution.source ?? "session"}:${contribution.session_id}`;
}

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

  // ADR-083: the boost for coming back after injury mode. Worded in weeks,
  // because that is what earned it; its fading is still counted in sessions.
  if (contribution.source === "comeback") {
    const weeks = contribution.protected_weeks ?? 0;
    return `${formatForm(contribution.weighted_contribution)} Form — comeback after ${weeks} ${
      weeks === 1 ? "week" : "weeks"
    } out injured`;
  }

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

/**
 * Form the listed sessions do not account for.
 *
 * `kut.player_form_contributions` reads `kut.session_report_results` only, so it
 * sees the `v_contributions` half of the engine's Form and nothing else:
 *
 *     v_form := least(8, greatest(0, v_contributions + v_legacy * <decay>))
 *
 * `v_legacy` is the Form a player carried over the rating-v2 cutover — goals
 * scored before self-reporting existed — decaying to nothing over the first four
 * v2 sessions. It is real Form, counted in `form_score` and in the OVR bonus,
 * but it has no session row to render, so before this the listed lines simply
 * did not add up to the stated total (Stephen: 1.00 + 1.25 listed, 2.88 total).
 *
 * A POSITIVE remainder is that carry-over. A NEGATIVE one is the `least(8, …)`
 * ceiling biting, where the sessions really do add up to more than the engine
 * kept. Both are stated rather than hidden.
 *
 * This is arithmetic over two numbers SQL computed, not a second rating engine
 * (ADR-064): it subtracts, it does not re-derive. The proper fix is to give the
 * carry-over its own column on `kut.player_rating_breakdown` so the amount is
 * read rather than inferred; until then the subtraction is exact, because
 * `v_contributions` is precisely what the contributions view sums.
 */
export function carriedForm(breakdown: RatingBreakdown, contributions: FormContribution[]): number {
  const listed = contributions.reduce(
    (total, contribution) => total + Math.max(0, contribution.weighted_contribution),
    0,
  );
  // Rounded to the precision the lines are rendered at, so float noise from
  // summing numerics never surfaces as a phantom 0.0000001 Form line. `|| 0`
  // normalises the negative zero that rounding a tiny negative remainder
  // produces, which would otherwise be formatted and compared as its own value.
  return Number((breakdown.form_score - listed).toFixed(2)) || 0;
}

/**
 * The carry-over rendered as one more row in the same list, so the rows sum to
 * the total. Deliberately does not name the cutover date or "rating v2" — a
 * member never saw that migration; what they remember is that reporting started.
 */
export function describeCarriedForm(amount: number): string {
  return `${formatForm(amount)} Form — carried over from before session reports began`;
}

/**
 * The carry-over's second line, matching `describeDecay`'s shape for a session
 * row. It fades over the first four sessions of the reporting era, which is the
 * same ladder a session walks, so the wording stays in sessions and never weeks.
 */
export function describeCarriedDecay(): string {
  return "From goals scored before self-reporting started · fading with every new session";
}

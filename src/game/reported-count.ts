/**
 * What a session's reported performance count means (ADR-101).
 *
 * Every real-life session stores one integer per attendee — `attendance.goals`
 * before rating v2, `session_reports.goals` / `session_report_results.effective_goals`
 * from it on. From the football week beginning 2026-09-28 that integer is the
 * member's goals and assists **combined** ("G+A"): 2 goals + 2 assists is stored
 * as 4. Before it, the same integer meant goals alone, and it still does — no
 * historical row is reinterpreted.
 *
 * The two parts are never stored separately and cannot be recovered, so a
 * post-cutover count is always rendered as one combined total ("4 G+A"), never as
 * goals and assists.
 *
 * The database column and RPC names (`goals`, `p_goals`, `effective_goals`,
 * `goal_form`) are compatibility names and do not change. The scoring does not
 * change either: the count feeds the same 0 / 1 / 1.25 / 1.5 Form ladder and the
 * same recent-week SHO modifier it always did. This module is copy only.
 *
 * The cutover is a Monday, so a football week is wholly on one side of it: a
 * week's Monday can be passed wherever a session date can. The SQL notices read
 * the same date through `kut._uses_combined_count` (migration 20261009000000).
 */

/** The first football week whose reported count means goals + assists. */
export const GOALS_ASSISTS_CUTOVER = "2026-09-28";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True when a session (or football week) dated `date` reports goals + assists.
 * A value that is not a `YYYY-MM-DD` date is treated as historical: every real
 * session date is one, and the historical reading is the one that never
 * relabels an existing value.
 */
export function reportsGoalsAndAssists(date: string | null | undefined): boolean {
  return typeof date === "string" && ISO_DATE.test(date) && date >= GOALS_ASSISTS_CUTOVER;
}

/** Compact label: "Goals" before the cutover, "G+A" from it. */
export function countLabel(date: string | null | undefined): "Goals" | "G+A" {
  return reportsGoalsAndAssists(date) ? "G+A" : "Goals";
}

/** Expanded label: "Goals" before the cutover, "Goals + Assists" from it. */
export function countLabelLong(date: string | null | undefined): "Goals" | "Goals + Assists" {
  return reportsGoalsAndAssists(date) ? "Goals + Assists" : "Goals";
}

/** The noun inside running copy: "goals" before the cutover, "G+A" from it. */
export function countNoun(date: string | null | undefined): "goals" | "G+A" {
  return reportsGoalsAndAssists(date) ? "G+A" : "goals";
}

/**
 * The count as a modifier before another noun: "goal total", "goal coverage"
 * before the cutover; "G+A total", "G+A coverage" from it.
 */
export function countAttributive(date: string | null | undefined): "goal" | "G+A" {
  return reportsGoalsAndAssists(date) ? "G+A" : "goal";
}

/** The report form's question for the session's count. */
export function countQuestion(date: string | null | undefined): string {
  return reportsGoalsAndAssists(date)
    ? "How many goals and assists did you get in total?"
    : "How many goals did you score?";
}

/** A historical, goals-only count: "1 goal", "2 goals". */
export function formatGoals(count: number): string {
  return `${count} ${count === 1 ? "goal" : "goals"}`;
}

/**
 * A combined count: "1 G+A", "4 G+A". Deliberately one number with one unit —
 * KUT does not know how the total splits into goals and assists.
 */
export function formatGoalsAssists(count: number): string {
  return `${count} G+A`;
}

/** A session's count in the terminology of its own date. */
export function formatReportedCount(count: number, date: string | null | undefined): string {
  return reportsGoalsAndAssists(date) ? formatGoalsAssists(count) : formatGoals(count);
}

/**
 * The same count for a screen reader, which would otherwise read "G+A" as
 * "G plus A": "4 goals and assists" from the cutover, "2 goals" before it.
 */
export function speakReportedCount(count: number, date: string | null | undefined): string {
  return reportsGoalsAndAssists(date) ? `${count} goals and assists` : formatGoals(count);
}

/**
 * A heading for a column whose rows may sit on either side of the cutover:
 * the one label when every row agrees, both when they are mixed.
 */
export function countColumnLabel(dates: readonly string[]): "Goals" | "G+A" | "Goals / G+A" {
  const combined = dates.filter((date) => reportsGoalsAndAssists(date)).length;
  if (combined === 0) return "Goals";
  if (combined === dates.length) return "G+A";
  return "Goals / G+A";
}

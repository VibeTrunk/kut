import { weekEnd, weekStart } from "@/game/football-week";
import { countNoun } from "@/game/reported-count";

export { weekEnd, weekStart };

export function isMonday(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && weekStart(value) === value;
}

export function formatChronicleDate(
  value: string,
  options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" },
) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

/**
 * The issue's one-line summary. The week's count is goals before the football
 * week of 28 Sep 2026 and goals + assists from it (ADR-101); a week is never
 * split, because the cutover is a Monday.
 */
export function issueStandfirst(
  sessionCount: number,
  appearances: number,
  count: number,
  weekStartIso: string,
) {
  return `${sessionCount === 1 ? "One session" : `${sessionCount} sessions`}, ${appearances} appearances and ${count} ${countNoun(weekStartIso)}.`;
}

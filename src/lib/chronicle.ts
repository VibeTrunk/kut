import { weekEnd, weekStart } from "@/game/football-week";

export { weekEnd, weekStart };

export function isMonday(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && weekStart(value) === value;
}

export function formatChronicleDate(value: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }) {
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: "UTC" }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function issueStandfirst(sessionCount: number, appearances: number, goals: number) {
  return `${sessionCount === 1 ? "One session" : `${sessionCount} sessions`}, ${appearances} appearances and ${goals} goals.`;
}

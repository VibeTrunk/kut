import { weekStart } from "@/game/football-week";
import { MIDWEEK, type MidweekConfig } from "./config";

/**
 * Lock and reveal times (BUILD_SPEC §44.1). The lock is Wednesday 20:00
 * Europe/Amsterdam; round r is revealed 30 minutes × r later.
 *
 * Amsterdam follows the EU rule: CEST (UTC+2) from 01:00 UTC on the last
 * Sunday of March until 01:00 UTC on the last Sunday of October, CET (UTC+1)
 * otherwise. A Wednesday evening never falls inside a changeover hour, so the
 * offset is simply that of the lock's date. SQL computes the same instant with
 * `(date + time '20:00') at time zone 'Europe/Amsterdam'`.
 */

const MINUTE_MS = 60_000;

function lastSundayUtc(year: number, month: number): number {
  const lastDay = new Date(Date.UTC(year, month + 1, 0));
  return lastDay.getUTCDate() - lastDay.getUTCDay();
}

/** UTC offset of Europe/Amsterdam, in hours, on a Wednesday. */
function amsterdamOffsetHours(year: number, month: number, day: number): number {
  const date = Date.UTC(year, month, day);
  const summerStart = Date.UTC(year, 2, lastSundayUtc(year, 2));
  const summerEnd = Date.UTC(year, 9, lastSundayUtc(year, 9));
  return date > summerStart && date < summerEnd ? 2 : 1;
}

/** The lock instant of the football week that starts on this ISO Monday. */
export function lockAt(weekStartIso: string, cfg: MidweekConfig = MIDWEEK): Date {
  if (weekStart(weekStartIso) !== weekStartIso) {
    throw new Error(`Expected an ISO Monday, received ${weekStartIso}`);
  }
  const [year, month, day] = weekStartIso.split("-").map(Number);
  const lockDay = new Date(Date.UTC(year, month - 1, day + cfg.schedule.lockDayOffset));
  const offset = amsterdamOffsetHours(
    lockDay.getUTCFullYear(),
    lockDay.getUTCMonth(),
    lockDay.getUTCDate(),
  );
  return new Date(
    Date.UTC(
      lockDay.getUTCFullYear(),
      lockDay.getUTCMonth(),
      lockDay.getUTCDate(),
      cfg.schedule.lockHourLocal - offset,
    ),
  );
}

export function revealAt(lock: Date, round: number, cfg: MidweekConfig = MIDWEEK): Date {
  return new Date(lock.getTime() + round * cfg.schedule.revealIntervalMinutes * MINUTE_MS);
}

/** The final is round R, so its reveal closes the tournament. */
export function finalRevealAt(lock: Date, rounds: number, cfg: MidweekConfig = MIDWEEK): Date {
  return revealAt(lock, rounds, cfg);
}

/** The ISO Monday of the first tournament whose lock is strictly after `now`. */
export function nextTournamentWeek(now: Date, cfg: MidweekConfig = MIDWEEK): string {
  let monday = weekStart(now.toISOString().slice(0, 10));
  for (;;) {
    if (lockAt(monday, cfg).getTime() > now.getTime()) return monday;
    const [year, month, day] = monday.split("-").map(Number);
    monday = new Date(Date.UTC(year, month - 1, day + 7)).toISOString().slice(0, 10);
  }
}

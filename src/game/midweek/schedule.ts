import { weekStart } from "@/game/football-week";
import { MIDWEEK, type MidweekConfig, type ScheduleVersionConfig } from "./config";

/**
 * The evening's clock (BUILD_SPEC §44.1, ADR-104): the lock, each round's
 * start, and when each event of a match is due. Every week follows the
 * schedule version it opened with, so a page reads the version from the
 * tournament, never from `MIDWEEK.schedule.current`.
 *
 * Version 2 locks Wednesday 19:55 Europe/Amsterdam and starts round r at
 * 20:00 + 15 minutes × (r − 1); a match plays its 14 chance slots over 4:40
 * and a shoot-out kick every 5 seconds after that. Version 1, every week up to
 * ADR-104, locked at 20:00 and revealed round r whole 30 minutes × r later.
 *
 * Amsterdam follows the EU rule: CEST (UTC+2) from 01:00 UTC on the last
 * Sunday of March until 01:00 UTC on the last Sunday of October, CET (UTC+1)
 * otherwise. A Wednesday evening never falls inside a changeover hour, so the
 * offset is simply that of the lock's date. SQL computes the same instant with
 * `(date + time '19:55') at time zone 'Europe/Amsterdam'`.
 *
 * Client-safe: imports neither the engine nor `rng.ts`.
 */

const SECOND_MS = 1_000;
const MINUTE_MS = 60 * SECOND_MS;

/**
 * The version a stored week follows. A row read before the ADR-104 migration
 * has no `schedule_version` and is version 1.
 */
export function scheduleFor(
  version: number | null | undefined,
  cfg: MidweekConfig = MIDWEEK,
): ScheduleVersionConfig {
  const schedule = cfg.schedule.versions[String(version ?? 1)];
  if (!schedule) throw new Error(`Unknown Midweek schedule version ${version}`);
  return schedule;
}

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
export function lockAt(
  weekStartIso: string,
  version: number = MIDWEEK.schedule.current,
  cfg: MidweekConfig = MIDWEEK,
): Date {
  if (weekStart(weekStartIso) !== weekStartIso) {
    throw new Error(`Expected an ISO Monday, received ${weekStartIso}`);
  }
  const schedule = scheduleFor(version, cfg);
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
      schedule.lockHourLocal - offset,
      schedule.lockMinuteLocal,
    ),
  );
}

/** When round `round` starts: under version 2 its matches kick off; under version 1 they are revealed whole. */
export function roundStartAt(
  lock: Date,
  round: number,
  version: number | null | undefined,
  cfg: MidweekConfig = MIDWEEK,
): Date {
  const schedule = scheduleFor(version, cfg);
  const minutes = schedule.roundOffsetMinutes + schedule.roundIntervalMinutes * (round - 1);
  return new Date(lock.getTime() + minutes * MINUTE_MS);
}

/** The part of an event the clock reads: a chance's minute, or its place after full time. */
export type TimedEvent = { kind: "chance"; minute: number } | { kind: "penalty" | "toss" };

export type MatchTiming = {
  /** Each event's reveal, in milliseconds after kick-off, in the events' order. */
  eventOffsetsMs: number[];
  /** Full time, or the last kick or settling draw of a shoot-out. */
  endOffsetMs: number;
};

/**
 * When each event of a match is due, after its kick-off. The match clock runs
 * from 0' to 90' over the chance slots, so a chance appears when the clock
 * reaches its minute; after full time each shoot-out kick, and a settling draw,
 * comes one `kickSeconds` after the one before. `kut._mm_match_timing` is the
 * SQL twin, pinned by the golden vectors.
 */
export function matchTiming(
  events: readonly TimedEvent[],
  version: number | null | undefined,
  cfg: MidweekConfig = MIDWEEK,
): MatchTiming {
  const schedule = scheduleFor(version, cfg);
  const regulationMs = cfg.match.chanceSlots * schedule.slotSeconds * SECOND_MS;
  const kickMs = schedule.kickSeconds * SECOND_MS;
  let afterFullTime = 0;
  const eventOffsetsMs = events.map((event) => {
    if (event.kind === "chance") {
      return Math.floor((event.minute * regulationMs) / cfg.match.minutes);
    }
    afterFullTime += 1;
    return regulationMs + afterFullTime * kickMs;
  });
  return { eventOffsetsMs, endOffsetMs: regulationMs + afterFullTime * kickMs };
}

/**
 * The longest a match can last: every slot, then a shoot-out through every
 * sudden-death round and a settling draw. It must end before the next round
 * starts, or a winner would be due in two matches at once.
 */
export function longestMatchMs(
  version: number | null | undefined,
  cfg: MidweekConfig = MIDWEEK,
): number {
  const kicks = 2 * (cfg.penalties.kicks + cfg.penalties.maxSuddenDeathRounds);
  const events: TimedEvent[] = Array.from({ length: kicks + 1 }, (_, index) => ({
    kind: index < kicks ? "penalty" : "toss",
  }));
  return matchTiming(events, version, cfg).endOffsetMs;
}

/** The ISO Monday of the first tournament whose lock is strictly after `now`. */
export function nextTournamentWeek(
  now: Date,
  version: number = MIDWEEK.schedule.current,
  cfg: MidweekConfig = MIDWEEK,
): string {
  let monday = weekStart(now.toISOString().slice(0, 10));
  for (;;) {
    if (lockAt(monday, version, cfg).getTime() > now.getTime()) return monday;
    const [year, month, day] = monday.split("-").map(Number);
    monday = new Date(Date.UTC(year, month - 1, day + 7)).toISOString().slice(0, 10);
  }
}

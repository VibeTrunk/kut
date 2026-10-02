import { describe, expect, it } from "vitest";
import { MIDWEEK } from "@/game/midweek/config";
import {
  lockAt,
  longestMatchMs,
  matchTiming,
  nextTournamentWeek,
  roundStartAt,
  scheduleFor,
} from "@/game/midweek/schedule";

function amsterdamClock(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

const VERSIONS = Object.keys(MIDWEEK.schedule.versions).map(Number);

describe("midweek schedule", () => {
  it("opens new weeks on version 2", () => {
    expect(MIDWEEK.schedule.current).toBe(2);
    expect(VERSIONS).toEqual([1, 2]);
  });

  it("reads a row without a version as version 1, and refuses an unknown one", () => {
    expect(scheduleFor(undefined)).toBe(MIDWEEK.schedule.versions["1"]);
    expect(scheduleFor(null)).toBe(MIDWEEK.schedule.versions["1"]);
    expect(() => scheduleFor(3)).toThrow();
  });

  it("locks on Wednesday 19:55 Amsterdam across daylight saving (version 2)", () => {
    // Last Wednesdays of March and October, either side of the changeover.
    expect(lockAt("2026-03-23").toISOString()).toBe("2026-03-25T18:55:00.000Z"); // CET, before 29 Mar
    expect(lockAt("2027-03-29").toISOString()).toBe("2027-03-31T17:55:00.000Z"); // CEST, after 28 Mar
    expect(lockAt("2026-10-26").toISOString()).toBe("2026-10-28T18:55:00.000Z"); // CET, after 25 Oct
    expect(lockAt("2027-10-25").toISOString()).toBe("2027-10-27T17:55:00.000Z"); // CEST, before 31 Oct
    expect(lockAt("2026-10-12").toISOString()).toBe("2026-10-14T17:55:00.000Z");
  });

  it("locked on Wednesday 20:00 Amsterdam on version 1", () => {
    expect(lockAt("2026-03-23", 1).toISOString()).toBe("2026-03-25T19:00:00.000Z");
    expect(lockAt("2026-09-21", 1).toISOString()).toBe("2026-09-23T18:00:00.000Z");
  });

  it("agrees with the platform time-zone database for every week of three years", () => {
    let monday = new Date(Date.UTC(2026, 0, 5));
    for (let week = 0; week < 156; week += 1) {
      const iso = monday.toISOString().slice(0, 10);
      expect(amsterdamClock(lockAt(iso))).toBe("Wed 19:55");
      expect(amsterdamClock(lockAt(iso, 1))).toBe("Wed 20:00");
      monday = new Date(monday.getTime() + 7 * 86_400_000);
    }
  });

  it("refuses anything but an ISO Monday", () => {
    expect(() => lockAt("2026-09-23")).toThrow();
  });

  it("starts round 1 at 20:00 and a round every 15 minutes (version 2)", () => {
    const lock = lockAt("2026-10-12");
    const starts = [1, 2, 3, 4, 5].map((round) => amsterdamClock(roundStartAt(lock, round, 2)));
    expect(starts).toEqual(["Wed 20:00", "Wed 20:15", "Wed 20:30", "Wed 20:45", "Wed 21:00"]);
  });

  it("revealed round r 30 minutes × r after the lock on version 1, as before", () => {
    const lock = lockAt("2026-09-21", 1);
    expect(roundStartAt(lock, 1, 1).toISOString()).toBe("2026-09-23T18:30:00.000Z");
    expect(roundStartAt(lock, 5, 1).toISOString()).toBe("2026-09-23T20:30:00.000Z");
    expect(roundStartAt(lock, 5, undefined).toISOString()).toBe("2026-09-23T20:30:00.000Z");
  });

  it("runs the match clock from 0' to 90' over 4:40, then a kick every 5 seconds", () => {
    const timing = matchTiming(
      [
        { kind: "chance", minute: 1 },
        { kind: "chance", minute: 45 },
        { kind: "chance", minute: 90 },
        { kind: "penalty" },
        { kind: "penalty" },
        { kind: "toss" },
      ],
      2,
    );
    expect(timing.eventOffsetsMs).toEqual([3_111, 140_000, 280_000, 285_000, 290_000, 295_000]);
    expect(timing.endOffsetMs).toBe(295_000);
    expect(matchTiming([{ kind: "chance", minute: 12 }], 2).endOffsetMs).toBe(280_000);
    expect(matchTiming([], 2).endOffsetMs).toBe(280_000);
  });

  it("puts every event of a version-1 match at its reveal", () => {
    const timing = matchTiming([{ kind: "chance", minute: 30 }, { kind: "penalty" }], 1);
    expect(timing).toEqual({ eventOffsetsMs: [0, 0], endOffsetMs: 0 });
  });

  it("ends the longest possible match before the next round starts, on every version", () => {
    // 4:40 of chances, 50 kicks through every sudden-death round and a settling draw.
    expect(longestMatchMs(2)).toBe(280_000 + 51 * 5_000);
    for (const version of VERSIONS) {
      expect(longestMatchMs(version)).toBeLessThan(
        scheduleFor(version).roundIntervalMinutes * 60_000,
      );
    }
  });

  it("finds the next tournament whose lock is still ahead", () => {
    expect(nextTournamentWeek(new Date("2026-10-14T17:54:59Z"))).toBe("2026-10-12");
    expect(nextTournamentWeek(new Date("2026-10-14T17:55:00Z"))).toBe("2026-10-19");
    expect(nextTournamentWeek(new Date("2026-09-23T17:59:59Z"), 1)).toBe("2026-09-21");
    expect(nextTournamentWeek(new Date("2026-09-27T22:30:00Z"))).toBe("2026-09-28"); // Monday 00:30 local
  });
});

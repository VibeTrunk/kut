import { describe, expect, it } from "vitest";
import { finalRevealAt, lockAt, nextTournamentWeek, revealAt } from "@/game/midweek/schedule";

function amsterdamClock(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

describe("midweek schedule", () => {
  it("locks on Wednesday 20:00 Amsterdam across daylight saving", () => {
    // Last Wednesdays of March and October, either side of the changeover.
    expect(lockAt("2026-03-23").toISOString()).toBe("2026-03-25T19:00:00.000Z"); // CET, before 29 Mar
    expect(lockAt("2027-03-29").toISOString()).toBe("2027-03-31T18:00:00.000Z"); // CEST, after 28 Mar
    expect(lockAt("2026-10-26").toISOString()).toBe("2026-10-28T19:00:00.000Z"); // CET, after 25 Oct
    expect(lockAt("2027-10-25").toISOString()).toBe("2027-10-27T18:00:00.000Z"); // CEST, before 31 Oct
    expect(lockAt("2026-09-21").toISOString()).toBe("2026-09-23T18:00:00.000Z");
  });

  it("agrees with the platform time-zone database for every week of three years", () => {
    let monday = new Date(Date.UTC(2026, 0, 5));
    for (let week = 0; week < 156; week += 1) {
      const iso = monday.toISOString().slice(0, 10);
      expect(amsterdamClock(lockAt(iso))).toBe("Wed 20:00");
      monday = new Date(monday.getTime() + 7 * 86_400_000);
    }
  });

  it("refuses anything but an ISO Monday", () => {
    expect(() => lockAt("2026-09-23")).toThrow();
  });

  it("reveals one round every 30 minutes, the final last", () => {
    const lock = lockAt("2026-09-21");
    expect(revealAt(lock, 1).toISOString()).toBe("2026-09-23T18:30:00.000Z");
    expect(finalRevealAt(lock, 5).toISOString()).toBe("2026-09-23T20:30:00.000Z");
  });

  it("finds the next tournament whose lock is still ahead", () => {
    expect(nextTournamentWeek(new Date("2026-09-23T17:59:59Z"))).toBe("2026-09-21");
    expect(nextTournamentWeek(new Date("2026-09-23T18:00:00Z"))).toBe("2026-09-28");
    expect(nextTournamentWeek(new Date("2026-09-27T22:30:00Z"))).toBe("2026-09-28"); // Monday 00:30 local
  });
});

import { describe, expect, it } from "vitest";
import {
  ARCHETYPES,
  ARCHETYPE_CHANGE_COOLDOWN_DAYS,
  ARCHETYPE_LABELS,
  archetypeLabel,
  formatArchetypeChangeAt,
  isArchetype,
  nextArchetypeChangeAt,
} from "@/game/archetypes";
import { ARCHETYPE_OFFSETS } from "@/game/rating-engine";

describe("archetypes", () => {
  it("accepts every known slug and rejects everything else", () => {
    for (const slug of ARCHETYPES) {
      expect(isArchetype(slug)).toBe(true);
    }
    // "keeper" stays bogus — the Goalkeeper archetype slug is "goalkeeper".
    for (const bogus of ["", "Speedster", "keeper", "all-rounder", "ALL_ROUNDER"]) {
      expect(isArchetype(bogus)).toBe(false);
    }
  });

  it("keeps labels, slugs and offsets in lock-step", () => {
    expect(Object.keys(ARCHETYPE_LABELS).sort()).toEqual([...ARCHETYPES].sort());
    expect(Object.keys(ARCHETYPE_OFFSETS).sort()).toEqual([...ARCHETYPES].sort());
  });

  it("labels a known slug and falls back readably for an unknown one", () => {
    expect(archetypeLabel("all_rounder")).toBe("All-rounder");
    expect(archetypeLabel("some_future_type")).toBe("some future type");
  });
});

describe("archetype change cooldown (ADR-094)", () => {
  const changedAt = "2026-10-01T18:15:00Z";

  it("is 14 days, as the SQL guard's 336 hours", () => {
    expect(ARCHETYPE_CHANGE_COOLDOWN_DAYS).toBe(14);
  });

  it("allows a change when the Player was never changed or the stamp is unreadable", () => {
    expect(nextArchetypeChangeAt(null)).toBeNull();
    expect(nextArchetypeChangeAt("not a date")).toBeNull();
  });

  it("returns the moment 336 hours after the last change while inside the window", () => {
    const next = nextArchetypeChangeAt(changedAt, new Date("2026-10-08T00:00:00Z"));
    expect(next?.toISOString()).toBe("2026-10-15T18:15:00.000Z");
    // One second before the end is still inside, matching `now() < next`.
    expect(nextArchetypeChangeAt(changedAt, new Date("2026-10-15T18:14:59Z"))).not.toBeNull();
  });

  it("allows a change from exactly 336 hours on, across a DST change", () => {
    // 2026-10-25 is the end of summer time in Europe/Amsterdam; the window is
    // elapsed time, so it still ends at the same UTC instant.
    const acrossDst = "2026-10-20T18:15:00Z";
    expect(nextArchetypeChangeAt(acrossDst, new Date("2026-11-03T18:15:00Z"))).toBeNull();
    expect(nextArchetypeChangeAt(acrossDst, new Date("2026-11-03T18:14:59Z"))?.toISOString()).toBe(
      "2026-11-03T18:15:00.000Z",
    );
  });

  it("formats the next moment in club time", () => {
    // 18:15 UTC is 20:15 in Amsterdam summer time and 19:15 in winter time.
    expect(formatArchetypeChangeAt(new Date("2026-10-15T18:15:00Z"))).toBe(
      "15 October 2026 at 20:15",
    );
    expect(formatArchetypeChangeAt(new Date("2026-11-03T18:15:00Z"))).toBe(
      "3 November 2026 at 19:15",
    );
  });

  it("rounds a part-minute up, so the time shown is never too early", () => {
    expect(formatArchetypeChangeAt(new Date("2026-10-15T18:15:00.123Z"))).toBe(
      "15 October 2026 at 20:16",
    );
  });
});

import { describe, expect, it } from "vitest";
import { ARCHETYPES, ARCHETYPE_LABELS, archetypeLabel, isArchetype } from "@/game/archetypes";
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

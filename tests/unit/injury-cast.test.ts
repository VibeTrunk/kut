import { describe, expect, it } from "vitest";
import { CAST_DOODLES, CAST_INKS, CAST_LINES, injuryCast } from "@/lib/injury-cast";

// Player ids are uuids. Sequential ones exercise small hash differences; the
// seeded ones spread across the whole id space.
const ids = [
  ...Array.from(
    { length: 200 },
    (_, i) => `00000000-0000-4000-8000-${i.toString(16).padStart(12, "0")}`,
  ),
  ...Array.from({ length: 200 }, (_, i) => {
    const hex = (Math.imul(i + 1, 0x9e3779b1) >>> 0).toString(16).padStart(8, "0");
    return `${hex}-${hex.slice(0, 4)}-4${hex.slice(1, 4)}-8${hex.slice(5, 8)}-${hex}${hex.slice(0, 4)}`;
  }),
];

describe("injuryCast", () => {
  it("gives the same cast for the same Player id every time", () => {
    for (const id of ids) {
      expect(injuryCast(id)).toEqual(injuryCast(id));
    }
  });

  it("never writes the same line twice on one cast", () => {
    for (const id of ids) {
      const cast = injuryCast(id);
      expect(cast.second).not.toBe(cast.first);
    }
  });

  it("keeps ink and doodle within their allowed values", () => {
    for (const id of ids) {
      const cast = injuryCast(id);
      expect(CAST_INKS).toContain(cast.ink);
      expect(CAST_DOODLES).toContain(cast.doodle);
    }
  });

  it("spreads Players across the whole pool, every ink and both doodles", () => {
    const casts = ids.map(injuryCast);
    expect(new Set(casts.map((cast) => cast.first)).size).toBe(CAST_LINES.length);
    expect(new Set(casts.map((cast) => cast.ink)).size).toBe(CAST_INKS.length);
    expect(new Set(casts.map((cast) => cast.doodle)).size).toBe(CAST_DOODLES.length);
  });
});

describe("CAST_LINES", () => {
  it("has no duplicate lines", () => {
    expect(new Set(CAST_LINES).size).toBe(CAST_LINES.length);
  });

  it("keeps every line to 20 characters, so slot 1 fits at every card size", () => {
    for (const line of CAST_LINES) {
      expect(line.length).toBeLessThanOrEqual(20);
    }
  });
});

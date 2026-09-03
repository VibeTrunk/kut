import { describe, expect, it } from "vitest";
import { applyLens, buildSlots, paginate, spreadFor, spreadPartner } from "@/lib/album";

const player = (id: string, name: string, archetype = "all_rounder") => ({ id, slug: id, display_name: name, archetype, photo_path: null, live_ovr: 30, pac: 30, sho: 30, pas: 30, dri: 30, def: 30, phy: 30, rarity_tier: "common" as const });

describe("album logic", () => {
  it("orders stably, uses nine slots per page, and pairs spreads", () => {
    const slots = buildSlots(Array.from({ length: 63 }, (_, i) => player(String(i).padStart(2, "0"), `Player ${String(63 - i).padStart(2, "0")}`)), []);
    expect(slots).toHaveLength(63);
    expect(slots[0].index).toBe(1);
    expect(paginate(slots, 7).pages.map((page) => page.length)).toEqual([9, 9, 9, 9, 9, 9, 9]);
    expect(spreadFor(5)).toEqual([5, 6]);
  });

  it("keeps positional numbers while lenses narrow results", () => {
    const slots = buildSlots([player("b", "Beta"), player("a", "Alpha", "defender")], []);
    expect(applyLens(slots, { kind: "specialists" })[0].index).toBe(1);
    expect(applyLens(slots, { kind: "gaps" })).toHaveLength(2);
  });

  it("names the facing leaf of a spread, and nothing past the last page", () => {
    expect(spreadPartner(5, 7)).toBe(6);
    expect(spreadPartner(6, 7)).toBe(5);
    expect(spreadPartner(7, 7)).toBeNull();
  });
});

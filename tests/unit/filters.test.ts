import { describe, expect, it } from "vitest";
import { buildFilterHref, countActiveFilters } from "@/lib/filters";

const base = { basePath: "/market", defaults: { sort: "newest" } };

describe("buildFilterHref", () => {
  it("returns the bare path when nothing is set", () => {
    expect(buildFilterHref({ ...base, values: {}, patch: {} })).toBe("/market");
  });

  it("applies a patch over the current values", () => {
    expect(buildFilterHref({ ...base, values: { q: "darryl" }, patch: { rarity: "gold" } })).toBe(
      "/market?q=darryl&rarity=gold",
    );
  });

  it("clears a param with an empty string", () => {
    // How a chip's "All tiers" and the mobile remove-chip both work.
    expect(buildFilterHref({ ...base, values: { q: "darryl", rarity: "gold" }, patch: { rarity: "" } })).toBe(
      "/market?q=darryl",
    );
  });

  it("keeps the default sort out of the URL", () => {
    // The canonical URL stays /market, not /market?sort=newest — these get
    // shared between members and bookmarked.
    expect(buildFilterHref({ ...base, values: {}, patch: { sort: "newest" } })).toBe("/market");
    expect(buildFilterHref({ ...base, values: {}, patch: { sort: "price" } })).toBe("/market?sort=price");
  });

  it("drops empty and whitespace-only values", () => {
    expect(buildFilterHref({ ...base, values: { q: "   ", rarity: undefined }, patch: {} })).toBe("/market");
  });

  it("trims what it keeps", () => {
    expect(buildFilterHref({ ...base, values: {}, patch: { q: "  darryl  " } })).toBe("/market?q=darryl");
  });

  it("carries preserved params through every change", () => {
    // The Collection's ?view=manage must survive filtering, or changing a tier
    // would throw the member back into the album.
    expect(
      buildFilterHref({
        basePath: "/club/collection",
        defaults: { sort: "ovr" },
        preserve: { view: "manage" },
        values: { rarity: "gold" },
        patch: { sort: "name" },
      }),
    ).toBe("/club/collection?view=manage&rarity=gold&sort=name");
  });

  it("lets values and the patch win over preserved params", () => {
    expect(
      buildFilterHref({ ...base, preserve: { q: "old" }, values: { q: "current" }, patch: {} }),
    ).toBe("/market?q=current");
  });

  it("encodes values that need it", () => {
    expect(buildFilterHref({ ...base, values: {}, patch: { q: "van oostrom & co" } })).toBe(
      "/market?q=van+oostrom+%26+co",
    );
  });

  it("clears everything when values are empty", () => {
    // The sheet's "Clear all", which keeps only the preserved params.
    expect(
      buildFilterHref({
        basePath: "/club/collection",
        defaults: {},
        preserve: { view: "manage" },
        values: {},
        patch: {},
      }),
    ).toBe("/club/collection?view=manage");
  });
});

describe("countActiveFilters", () => {
  it("counts only params that narrow the view", () => {
    expect(countActiveFilters({ q: "darryl", rarity: "gold", sort: "price" }, ["sort"])).toBe(2);
  });

  it("ignores empty values", () => {
    expect(countActiveFilters({ q: "", rarity: undefined, min: "  " }, ["sort"])).toBe(0);
  });

  it("never counts sort, so the pill can read zero", () => {
    expect(countActiveFilters({ sort: "price" }, ["sort"])).toBe(0);
  });
});

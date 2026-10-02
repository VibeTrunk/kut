import { describe, expect, it } from "vitest";
import {
  ACCOUNT_ROUTES,
  COMPETE_STATUS,
  COMPETE_TABS,
  MARKET_TABS,
  PRIMARY_TABS,
  activeEntryKey,
  ariaCurrent,
  buildCompeteTabs,
  formatBadgeCount,
  isSegmentPrefix,
} from "@/lib/nav/routes";

describe("isSegmentPrefix", () => {
  it("matches a route and its segment subtree", () => {
    expect(isSegmentPrefix("/market", "/market")).toBe(true);
    expect(isSegmentPrefix("/market", "/market/offers")).toBe(true);
    expect(isSegmentPrefix("/market", "/market/1cf3b0a2")).toBe(true);
  });

  it("respects the segment boundary", () => {
    // A plain startsWith would match these, lighting Market on an unrelated route.
    expect(isSegmentPrefix("/market", "/marketplace")).toBe(false);
    expect(isSegmentPrefix("/club", "/clubhouse")).toBe(false);
  });

  it("treats the root as itself only", () => {
    expect(isSegmentPrefix("/", "/")).toBe(true);
    expect(isSegmentPrefix("/", "/market")).toBe(false);
    expect(isSegmentPrefix("/", "/club/collection")).toBe(false);
  });
});

describe("activeEntryKey — primary tabs", () => {
  it.each([
    ["/", "home"],
    ["/club/collection", "collection"],
    ["/club/collection?view=manage", "collection"],
    ["/club/packs", "packs"],
    ["/market", "market"],
    ["/market/offers", "market"],
    ["/leaderboard", "compete"],
    ["/players", "compete"],
    ["/chronicle", "home"],
    ["/chronicle/2026-08-31", "home"],
    ["/club/value", "collection"],
    // DR1-1/DR1-2 (ADR-107): Midweek Madness moved from Home to Compete, with
    // its result pages.
    ["/midweek", "compete"],
    ["/midweek/2026-10-05", "compete"],
    ["/midweek/2026-10-05/match/8f14e45f", "compete"],
  ])("%s activates %s", (pathname, expected) => {
    // The query string never reaches usePathname(), but pin the plain paths anyway.
    expect(activeEntryKey(PRIMARY_TABS, pathname.split("?")[0])).toBe(expected);
  });

  it("places every member destination under some tab", () => {
    // The point of the restructure: nothing a member can reach should leave the
    // chrome blank. Routes owned by the messages button or the avatar are the
    // deliberate exceptions and are asserted separately below.
    for (const pathname of [
      "/chronicle",
      "/midweek",
      "/club/value",
      "/players",
      "/market/offers",
    ]) {
      expect(activeEntryKey(PRIMARY_TABS, pathname)).not.toBeNull();
    }
  });

  it("keeps a tab lit on its detail routes", () => {
    expect(activeEntryKey(PRIMARY_TABS, "/club/collection/8f14e45f")).toBe("collection");
    expect(activeEntryKey(PRIMARY_TABS, "/club/packs/8f14e45f")).toBe("packs");
    expect(activeEntryKey(PRIMARY_TABS, "/market/8f14e45f")).toBe("market");
    expect(activeEntryKey(PRIMARY_TABS, "/players/alex-example")).toBe("compete");
  });

  it("returns null where no primary tab owns the route", () => {
    // The net for the classic startsWith("/") bug, where Home lights up everywhere.
    // Messages, the account routes and Admin are chrome controls of their own
    // (the messages button and the avatar), not primary tabs.
    for (const pathname of [
      "/messages",
      "/settings",
      "/settings/card",
      "/how-it-works",
      "/admin/attendance",
    ]) {
      expect(activeEntryKey(PRIMARY_TABS, pathname)).toBeNull();
    }
  });
});

describe("activeEntryKey — longest prefix wins", () => {
  it("separates a section index from its nested tab", () => {
    expect(activeEntryKey(MARKET_TABS, "/market")).toBe("buy");
    expect(activeEntryKey(MARKET_TABS, "/market/offers")).toBe("offers");
    // A listing id is not the offers tab, and must not fall through to nothing.
    expect(activeEntryKey(MARKET_TABS, "/market/8f14e45f")).toBe("buy");
  });

  it("separates Settings from My card in the account menu", () => {
    expect(activeEntryKey(ACCOUNT_ROUTES, "/settings")).toBe("settings");
    expect(activeEntryKey(ACCOUNT_ROUTES, "/settings/card")).toBe("card");
  });

  it("resolves Compete's section tabs", () => {
    expect(activeEntryKey(COMPETE_TABS, "/midweek")).toBe("midweek");
    expect(activeEntryKey(COMPETE_TABS, "/midweek/2026-10-05")).toBe("midweek");
    expect(activeEntryKey(COMPETE_TABS, "/leaderboard")).toBe("standings");
    expect(activeEntryKey(COMPETE_TABS, "/players")).toBe("players");
    expect(activeEntryKey(COMPETE_TABS, "/players/alex-example")).toBe("players");
  });

  it("activates Admin from any admin route via `owns`", () => {
    expect(activeEntryKey(ACCOUNT_ROUTES, "/admin/attendance")).toBe("admin");
    expect(activeEntryKey(ACCOUNT_ROUTES, "/admin/economy")).toBe("admin");
    expect(activeEntryKey(ACCOUNT_ROUTES, "/admin/attendance/8f14e45f")).toBe("admin");
  });

  it("resolves admin tabs to the deepest matching tab", () => {
    // Guards the AdminTabs migration onto the shared resolver.
    const adminTabs = [
      { key: "attendance", href: "/admin/attendance", label: "Attendance" },
      { key: "roster", href: "/admin/roster", label: "Roster" },
      { key: "links", href: "/admin/links", label: "Accounts" },
      { key: "accounts", href: "/admin/accounts", label: "Recovery" },
      { key: "economy", href: "/admin/economy", label: "Economy" },
      { key: "invites", href: "/admin/invites", label: "Invites" },
    ];
    expect(activeEntryKey(adminTabs, "/admin/attendance")).toBe("attendance");
    expect(activeEntryKey(adminTabs, "/admin/attendance/8f14e45f")).toBe("attendance");
    expect(activeEntryKey(adminTabs, "/admin/accounts")).toBe("accounts");
    expect(activeEntryKey(adminTabs, "/admin")).toBeNull();
  });
});

describe("ariaCurrent", () => {
  const market = PRIMARY_TABS.find((tab) => tab.key === "market")!;
  const compete = PRIMARY_TABS.find((tab) => tab.key === "compete")!;

  it("marks the exact page", () => {
    expect(ariaCurrent(market, "/market", "market")).toBe("page");
  });

  it("marks a containing tab as an ancestor, not the page", () => {
    // Otherwise /market/offers carries two aria-current="page" at once: the
    // primary tab and the Offers section tab.
    expect(ariaCurrent(market, "/market/offers", "market")).toBe("true");
    expect(ariaCurrent(compete, "/players", "compete")).toBe("true");
    expect(ariaCurrent(compete, "/leaderboard", "compete")).toBe("true");
    expect(ariaCurrent(market, "/market/8f14e45f", "market")).toBe("true");
  });

  it("marks nothing when the entry is not active", () => {
    expect(ariaCurrent(market, "/leaderboard", "compete")).toBeUndefined();
    expect(ariaCurrent(market, "/messages", null)).toBeUndefined();
  });
});

describe("formatBadgeCount", () => {
  it("renders nothing at or below zero", () => {
    expect(formatBadgeCount(0)).toBe("");
    expect(formatBadgeCount(-1)).toBe("");
  });

  it("renders a plain count", () => {
    expect(formatBadgeCount(1)).toBe("1");
    expect(formatBadgeCount(3)).toBe("3");
    expect(formatBadgeCount(99)).toBe("99");
  });

  it("caps at 99+ so the badge cannot widen the bottom bar's tracks", () => {
    expect(formatBadgeCount(100)).toBe("99+");
    expect(formatBadgeCount(143)).toBe("99+");
  });

  it("survives a non-finite count", () => {
    expect(formatBadgeCount(Number.NaN)).toBe("");
  });
});

describe("route tables", () => {
  it("keeps keys unique within each table", () => {
    for (const table of [PRIMARY_TABS, ACCOUNT_ROUTES, MARKET_TABS, COMPETE_TABS]) {
      expect(new Set(table.map((entry) => entry.key)).size).toBe(table.length);
    }
  });

  it("ships exactly five primary tabs, per BUILD_SPEC §46", () => {
    expect(PRIMARY_TABS.map((tab) => tab.label)).toEqual([
      "Home",
      "Collection",
      "Packs",
      "Market",
      "Compete",
    ]);
  });

  it("lands Compete on Midweek, with Midweek · Standings · Players as its sections (ADR-107)", () => {
    expect(PRIMARY_TABS.find((tab) => tab.key === "compete")?.href).toBe("/midweek");
    expect(COMPETE_TABS.map((tab) => [tab.label, tab.href])).toEqual([
      ["Midweek", "/midweek"],
      ["Standings", "/leaderboard"],
      ["Players", "/players"],
    ]);
  });

  it("marks only Admin as admin-only", () => {
    expect(ACCOUNT_ROUTES.filter((entry) => entry.adminOnly).map((entry) => entry.key)).toEqual([
      "admin",
    ]);
  });
});

describe("Compete's status", () => {
  it("puts Live on the Midweek section tab, and nothing else anywhere", () => {
    expect(buildCompeteTabs("live").map((tab) => tab.status)).toEqual([
      "live",
      undefined,
      undefined,
    ]);
  });

  it("leaves Pick off the section tabs: the picker is where it asks", () => {
    expect(buildCompeteTabs("pick").every((tab) => tab.status === undefined)).toBe(true);
    expect(buildCompeteTabs(null).every((tab) => tab.status === undefined)).toBe(true);
  });

  it("names both badges in words for screen readers", () => {
    expect(COMPETE_STATUS.pick).toEqual({
      text: "Pick",
      label: "Midweek Madness: you haven't picked your five",
    });
    expect(COMPETE_STATUS.live).toEqual({ text: "Live", label: "Midweek Madness is live" });
  });
});

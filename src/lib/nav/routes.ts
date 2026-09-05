/**
 * Route tables and the "which entry is current" resolver for every navigation
 * surface: the primary tabs, the account menu, and each section's in-page tabs.
 *
 * Pure on purpose — no React, no `next/*`, no Supabase. That is what lets
 * `tests/unit/nav-routes.test.ts` cover the matching rules at all, since the
 * repo has no jsdom or React Testing Library and cannot assert on rendering.
 * Same reasoning as `src/components/pack-reveal-state.ts`.
 *
 * Deliberately NOT re-exported from an `index.ts` alongside `./context.ts`:
 * that module imports the server Supabase client, and a barrel would drag it
 * into the client bundle through `app-nav.tsx`.
 */

export type RouteEntry = {
  /** Stable identity, independent of the href. Used to key the active entry. */
  key: string;
  /** Where the entry navigates. */
  href: string;
  label: string;
  /**
   * Prefixes this entry highlights for, defaulting to `[href]`. Leaderboard
   * owns `/players` so the tab stays lit on the directory beneath it.
   */
  owns?: readonly string[];
  adminOnly?: boolean;
};

/**
 * True when `pathname` is `href` or sits inside its segment subtree.
 *
 * The segment boundary matters: a plain `startsWith` would make `/market`
 * match `/marketplace`. `"/"` is special-cased to itself, or Home would own
 * every route in the app.
 */
export function isSegmentPrefix(href: string, pathname: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The key of the entry that owns `pathname`, or `null` when none does.
 *
 * Longest owned prefix wins. This cannot be expressed as independent per-item
 * predicates, which is why the old `isActive` closures were replaced: `/market`
 * and `/market/offers` are both tabs, so a prefix test lights both on the
 * offers page, while an exact test on `/market` stops lighting anything on
 * `/market/[listingId]`. Only a whole-list resolver gets both right.
 */
export function activeEntryKey(entries: readonly RouteEntry[], pathname: string): string | null {
  let bestKey: string | null = null;
  let bestLength = -1;

  for (const entry of entries) {
    for (const owned of entry.owns ?? [entry.href]) {
      if (!isSegmentPrefix(owned, pathname)) continue;
      if (owned.length > bestLength) {
        bestLength = owned.length;
        bestKey = entry.key;
      }
    }
  }

  return bestKey;
}

/**
 * `"page"` for the exact page, `"true"` for an ancestor that merely contains
 * it, `undefined` for everything else.
 *
 * The distinction keeps a screen from carrying two `aria-current="page"` at
 * once: on `/market/offers` the Market tab is an ancestor (`"true"`) and the
 * Offers section tab is the page itself (`"page"`).
 */
export function ariaCurrent(
  entry: RouteEntry,
  pathname: string,
  activeKey: string | null,
): "page" | "true" | undefined {
  if (entry.key !== activeKey) return undefined;
  return pathname === entry.href ? "page" : "true";
}

/** Badge text. Empty at zero so callers can treat it as "render nothing". */
export function formatBadgeCount(count: number): string {
  if (!Number.isFinite(count) || count <= 0) return "";
  return count > 99 ? "99+" : String(Math.floor(count));
}

/**
 * The five primary destinations, in bar order. Identical on the desktop top bar
 * and the mobile bottom tab bar — `BUILD_SPEC.md` §46 is the canonical record.
 */
export const PRIMARY_TABS: readonly RouteEntry[] = [
  // Home owns the Chronicle: both answer "what happened this week", Home is
  // where you enter it, and without this the Chronicle would be the one member
  // destination the chrome cannot place you in.
  { key: "home", href: "/", label: "Home", owns: ["/", "/chronicle"] },
  // Club Value is "my club" and is now reached from the Collection header.
  { key: "collection", href: "/club/collection", label: "Collection", owns: ["/club/collection", "/club/value"] },
  { key: "packs", href: "/club/packs", label: "Packs" },
  { key: "market", href: "/market", label: "Market" },
  // The directory is a tab inside this section, so the primary tab owns it too.
  { key: "leaderboard", href: "/leaderboard", label: "Leaderboard", owns: ["/leaderboard", "/players"] },
];

/** Everything behind the avatar. Account only — no content lives here. */
export const ACCOUNT_ROUTES: readonly RouteEntry[] = [
  { key: "settings", href: "/settings", label: "Settings" },
  { key: "card", href: "/settings/card", label: "My card" },
  { key: "how", href: "/how-it-works", label: "How KUT works" },
  { key: "admin", href: "/admin/attendance", label: "Admin", owns: ["/admin"], adminOnly: true },
];

/** Section tabs. Text-only: `SectionTabs` is a client component rendered by
 *  server pages, so a component prop would fail the RSC boundary. */
export const MARKET_TABS: readonly RouteEntry[] = [
  { key: "buy", href: "/market", label: "Buy" },
  { key: "offers", href: "/market/offers", label: "Offers" },
];

/** A route entry carrying a per-request count. */
export type BadgedRoute = RouteEntry & { badgeCount?: number; badgeNoun?: string };

/**
 * Market's tabs with the incoming-offer count on Offers. Built here rather
 * than at each call site so `/market` and `/market/offers` cannot render
 * different numbers for the same thing.
 */
export function buildMarketTabs(incomingOfferCount: number): BadgedRoute[] {
  return MARKET_TABS.map((tab) =>
    tab.key === "offers" && incomingOfferCount > 0
      ? { ...tab, badgeCount: incomingOfferCount, badgeNoun: "incoming offers" }
      : { ...tab },
  );
}

export const LEADERBOARD_TABS: readonly RouteEntry[] = [
  { key: "clubs", href: "/leaderboard", label: "Clubs" },
  { key: "players", href: "/players", label: "Players" },
];

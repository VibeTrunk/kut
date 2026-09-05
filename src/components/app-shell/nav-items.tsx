import {
  IconAdmin,
  IconCollection,
  IconHome,
  IconInfo,
  IconLeaderboard,
  IconMarket,
  IconPack,
  IconSettings,
  IconUser,
} from "@/components/icons";
import { ACCOUNT_ROUTES, PRIMARY_TABS, type RouteEntry } from "@/lib/nav/routes";
import type { ComponentType, SVGProps } from "react";

/**
 * Binds icons and per-request badge counts onto the route tables in
 * `@/lib/nav/routes`. The tables themselves stay pure so they can be
 * unit-tested; icons live here because this module is only ever imported from
 * inside the client boundary (`app-nav.tsx`).
 *
 * Section tabs deliberately get no icons — `SectionTabs` is rendered by server
 * pages, and a component cannot cross the RSC boundary as a prop.
 */
export type NavItem = RouteEntry & {
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** Absent or 0 renders no badge. */
  badgeCount?: number;
  /** Screen-reader context for the number, e.g. "Market 2 incoming trade offers". */
  badgeNoun?: string;
};

type IconMap = Record<string, ComponentType<SVGProps<SVGSVGElement>>>;

const PRIMARY_ICONS: IconMap = {
  home: IconHome,
  collection: IconCollection,
  packs: IconPack,
  market: IconMarket,
  leaderboard: IconLeaderboard,
};

const ACCOUNT_ICONS: IconMap = {
  settings: IconSettings,
  card: IconUser,
  how: IconInfo,
  admin: IconAdmin,
};

export function buildPrimaryNavItems(incomingOfferCount: number): NavItem[] {
  return PRIMARY_TABS.map((entry) => ({
    ...entry,
    Icon: PRIMARY_ICONS[entry.key],
    // Offers live under Market, so their count rides the Market tab rather than
    // a menu row of their own (ADR-053).
    ...(entry.key === "market" && incomingOfferCount > 0
      ? { badgeCount: incomingOfferCount, badgeNoun: "incoming trade offers" }
      : {}),
  }));
}

export function buildAccountMenuItems(isAdmin: boolean): NavItem[] {
  return ACCOUNT_ROUTES.filter((entry) => !entry.adminOnly || isAdmin).map((entry) => ({
    ...entry,
    Icon: ACCOUNT_ICONS[entry.key],
  }));
}
